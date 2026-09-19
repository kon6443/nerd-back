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
  /**
   * 쉬는 상태의 책이 들어가야 할 가로 구간(캔버스 px). 주면 책 모서리가 이 안에 들도록 줄이고
   * 오른쪽 끝을 `right` 에 맞춘다. 진입 연출이 진행될수록 원래 화면 전체 구도로 돌아간다.
   */
  bounds?: { left: number; right: number };
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
    coverDark: token("book-cover-strong"), leaf: token("scene-leaf"), gold: token("gold"),
    sky: token("scene-sky"), rose: token("danger-soft"),
  };
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(palette.paper, 22, 65);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const book = createBookModel(palette);
  // 구름·반짝이는 책 밖으로 흩어져 있어 끝선 맞춤에서 뺀다 — 책 본체의 실제 점만 잰다.
  // 책 전체의 경계 상자를 쓰면 성 꼭대기 높이의 빈 공간까지 재서 책이 선보다 안쪽에 멈춘다.
  const bookCorners = samplePoints(book);
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
  let appliedZoom = Number.NaN;
  let appliedShift = Number.NaN;
  let fitKey = "";
  let fit = { zoom: 1, shift: 0 };
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
      const key = frame.bounds ? `${width}x${height}:${frame.bounds.left}-${frame.bounds.right}` : "";
      if (key !== fitKey) {
        fitKey = key;
        fit = frame.bounds ? fitToBounds(camera, bookCorners, width, height, frame.bounds) : { zoom: 1, shift: 0 };
        appliedZoom = Number.NaN; // 측정하느라 카메라를 건드렸으니 아래에서 다시 적용한다.
      }
      const pose = bookCamera(frame.entry, width / height);
      atmosphere.update(frame.entry);
      const pointerWeight = 1 - frame.entry;
      // 맞춤은 쉬는 구도에만 쓴다. 진입할수록 1·0 으로 풀어 문 안으로 들어가는 연출은 그대로 둔다.
      const zoom = 1 + (fit.zoom - 1) * pointerWeight;
      const shift = fit.shift * pointerWeight;
      if (offsetX !== pose.offset.x || offsetY !== pose.offset.y || appliedZoom !== zoom || appliedShift !== shift) {
        offsetX = pose.offset.x;
        offsetY = pose.offset.y;
        appliedZoom = camera.zoom = zoom;
        appliedShift = shift;
        camera.setViewOffset(width, height, width * offsetX + shift, height * offsetY, width, height);
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

/** 책 모델의 부품마다 경계 상자 모서리를 월드 좌표로 모은다. 부품 단위라 모서리가 실제 모양에 붙는다. */
function samplePoints(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const points: THREE.Vector3[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
    object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox;
    if (!box) return;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      points.push(new THREE.Vector3(x, y, z).applyMatrix4(object.matrixWorld));
    }
  });
  return points;
}

/** 쉬는 구도(진입 0, 포인터 0)에서 책 모서리를 화면에 투영해 `bounds` 에 들어갈 배율과 가로 이동량(px)을 구한다. */
function fitToBounds(camera: THREE.PerspectiveCamera, corners: THREE.Vector3[], width: number, height: number, bounds: { left: number; right: number }) {
  const pose = bookCamera(0, width / height);
  const baseShift = width * pose.offset.x;
  camera.position.set(...pose.position);
  camera.lookAt(...pose.target);
  camera.updateMatrixWorld();
  const project = (zoom: number) => {
    camera.zoom = zoom;
    camera.setViewOffset(width, height, baseShift, height * pose.offset.y, width, height);
    const xs = corners.map((corner) => (corner.clone().project(camera).x + 1) / 2 * width);
    return { left: Math.min(...xs), right: Math.max(...xs) };
  };
  const natural = project(1);
  const zoom = Math.min(1, Math.max(0.5, (bounds.right - bounds.left) / (natural.right - natural.left)));
  const fitted = project(zoom);
  // setViewOffset 의 offsetX 는 화면 px 단위라, 늘리는 만큼 장면이 왼쪽으로 움직인다.
  return { zoom, shift: fitted.right - bounds.right };
}
