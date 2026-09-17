import * as THREE from "three";
import { bookCamera } from "@/app/book-camera";
import { createBookAtmosphere } from "@/app/book-atmosphere";
import { createBookModel, type BookPalette } from "@/app/book-model";

export type BookWorldFrame = {
  entry: number;
  width: number;
  height: number;
  pointerX: number;
  pointerY: number;
};

export function createBookWorld(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "default" });
  try {
    return initializeBookWorld(canvas, renderer);
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
}

function initializeBookWorld(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  // 동기 GPU 진단 조회는 개발 중에만 수행한다. production의 첫 프레임 대기를 줄인다.
  renderer.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const tokens = getComputedStyle(document.documentElement);
  const token = (name: string) => tokens.getPropertyValue(`--color-${name}`).trim();
  const palette: BookPalette = {
    paper: token("paper"), edge: token("paper-edge-strong"), cover: token("book-cover"),
    coverDark: token("book-cover-strong"), leaf: token("primary-tint"), gold: token("gold"),
    sky: token("accent-a"), rose: token("danger-soft"),
  };
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(palette.paper, 22, 65);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const book = createBookModel(palette);
  const atmosphere = createBookAtmosphere(palette);
  book.add(atmosphere.group);
  scene.add(book);
  // Three r186의 공용 DFG LUT는 renderer.dispose()만으로 dispose 리스너가 제거되지 않는다.
  // 공개 shader callback에서 uniform을 받아, renderer가 살아 있을 때 Texture.dispose()한다.
  const lightingUniforms = new Set<THREE.IUniform<unknown>>();
  book.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const surfaces = Array.isArray(object.material) ? object.material : [object.material];
    surfaces.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.onBeforeCompile = (shader) => {
          if (shader.uniforms.dfgLUT) lightingUniforms.add(shader.uniforms.dfgLUT);
        };
      }
    });
  });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.ShadowMaterial({ color: palette.coverDark, opacity: 0.13 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.15;
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(new THREE.HemisphereLight(palette.paper, palette.edge, 1.6));
  const sunlight = new THREE.DirectionalLight(palette.paper, 2.7);
  sunlight.position.set(-3, 10, 7);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1536, 1536);
  sunlight.shadow.camera.left = -7;
  sunlight.shadow.camera.right = 7;
  sunlight.shadow.camera.top = 7;
  sunlight.shadow.camera.bottom = -7;
  sunlight.shadow.camera.near = 0.5;
  sunlight.shadow.camera.far = 25;
  sunlight.shadow.normalBias = 0.025;
  sunlight.shadow.bias = -0.0001;
  scene.add(sunlight);
  const rim = new THREE.DirectionalLight(palette.sky, 1);
  rim.position.set(4, 6, -5);
  scene.add(rim);

  let width = 0;
  let height = 0;
  let offsetX = Number.NaN;
  let offsetY = Number.NaN;
  let disposed = false;
  canvas.dataset.scene = "three-pop-up-book";
  const restoreShadows = () => { renderer.shadowMap.needsUpdate = true; };
  canvas.addEventListener("webglcontextrestored", restoreShadows);

  return {
    render(frame: BookWorldFrame) {
      if (disposed || renderer.getContext().isContextLost() || frame.width <= 0 || frame.height <= 0) return false;
      if (width !== frame.width || height !== frame.height) {
        width = frame.width;
        height = frame.height;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        offsetX = Number.NaN;
      }
      const pose = bookCamera(frame.entry, width / height);
      atmosphere.update(frame.entry);
      const pointerWeight = 1 - frame.entry;
      if (offsetX !== pose.offset.x || offsetY !== pose.offset.y) {
        offsetX = pose.offset.x;
        offsetY = pose.offset.y;
        camera.setViewOffset(width, height, width * offsetX, height * offsetY, width, height);
      }
      camera.position.set(pose.position[0] + frame.pointerX * 0.65 * pointerWeight, pose.position[1] - frame.pointerY * 0.32 * pointerWeight, pose.position[2] - frame.pointerX * 0.2 * pointerWeight);
      camera.lookAt(...pose.target);
      renderer.render(scene, camera);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("webglcontextrestored", restoreShadows);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          if (object instanceof THREE.InstancedMesh) object.dispose();
          geometries.add(object.geometry);
          const surfaces = Array.isArray(object.material) ? object.material : [object.material];
          surfaces.forEach(surface => materials.add(surface));
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(surface => surface.dispose());
      const lightingTextures = new Set<THREE.Texture>();
      lightingUniforms.forEach(({ value }) => {
        if (value instanceof THREE.Texture) lightingTextures.add(value);
      });
      lightingTextures.forEach(texture => texture.dispose());
      lightingUniforms.clear();
      sunlight.shadow.dispose();
      scene.clear();
      renderer.dispose();
      // renderer 전용 canvas이므로 기본 텍스처 등 context 소유 자원까지 모두 반환한다.
      renderer.forceContextLoss();
    },
  };
}

export type BookWorld = ReturnType<typeof createBookWorld>;
