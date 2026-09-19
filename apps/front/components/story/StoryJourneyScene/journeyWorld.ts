import * as THREE from "three";
import { createJourneyCharacter, createJourneyPhone } from "./journeyCharacter";
import { createJourneyScenery } from "./journeyObjects";
import { createJourneyPose, sampleJourney, smooth, type JourneyPose } from "./journeyTimeline";

export interface JourneyWorld {
  render: (elapsed: number, pointerX: number, pointerY: number) => JourneyPose;
  resize: (width: number, height: number) => void;
  burst: () => void;
  dispose: () => void;
}

function createStars(count: number, burst: boolean) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Deterministic placement makes re-entry and visual testing consistent.
    const angle = i * 2.39996;
    const radius = burst ? 0.3 + i % 11 * 0.13 : 1.2 + i % 19 * 0.23;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = burst ? Math.sin(angle) * radius : (i % 31) / 31 * 7 - 2;
    positions[i * 3 + 2] = burst ? -i % 7 * 0.1 : -(i / count) * 38;
    seeds[i] = i * 0.71;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, opacity: { value: 0 }, pixelRatio: { value: 1 }, burstAge: { value: burst ? 0 : -1 } },
    vertexShader: `attribute float seed; uniform float time; uniform float pixelRatio; uniform float burstAge; varying float sparkle;
      void main() {
        vec3 p = position;
        if (burstAge >= 0.0) { p *= 0.35 + burstAge * 2.4; p.y -= burstAge * burstAge * 0.8; }
        else { p.x += sin(time * 0.55 + seed) * 0.18; p.y += sin(time * 0.8 + seed) * 0.16; }
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        sparkle = 0.6 + 0.4 * sin(time * 1.8 + seed);
        gl_PointSize = clamp(55.0 / max(1.0, -view.z), 2.0, 11.0) * pixelRatio;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `uniform float opacity; varying float sparkle;
      void main() {
        vec2 p = abs(gl_PointCoord - 0.5) * 2.0;
        float diamond = max(0.0, 1.0 - (p.x + p.y));
        float rays = pow(max(0.0, 1.0 - min(p.x, p.y)), 12.0) * max(0.0, 1.0 - max(p.x, p.y));
        gl_FragColor = vec4(1.0, 0.91, 0.66, (diamond * diamond + rays * 0.55) * opacity * sparkle);
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

export function createJourneyWorld(canvas: HTMLCanvasElement): JourneyWorld {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
  const scene = new THREE.Scene();
  let disposed = false;
  let sun: THREE.DirectionalLight | null = null;
  const pose = createJourneyPose();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line)) return;
      if (object instanceof THREE.InstancedMesh) object.dispose();
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    textures.forEach(texture => texture.dispose());
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    sun?.shadow.dispose();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
  };
  try {
    renderer.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    scene.background = new THREE.Color("#c5e4ee");
    scene.fog = new THREE.Fog("#d5e9ed", 28, 90);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.15, 150);
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec3 direction; void main(){
        vec3 d=normalize(direction);
        vec3 sky=mix(vec3(0.80,0.90,0.95),vec3(0.40,0.71,0.89),smoothstep(-0.7,0.75,d.y));
        float sun=max(0.0,dot(d,normalize(vec3(-0.5,0.16,-0.8))));
        sky+=vec3(0.2,0.14,0.04)*pow(sun,12.0)+vec3(0.35,0.25,0.1)*pow(sun,200.0);
        gl_FragColor=vec4(sky,1.0);
      }`,
    }));
    scene.add(skyDome);
    scene.add(new THREE.HemisphereLight("#fffaf0", "#a9b7c1", 1.6));
    sun = new THREE.DirectionalLight("#fff2d9", 2.2);
    sun.position.set(-12, 26, -8);
    sun.target.position.set(0, 0, -28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 38, bottom: -38, near: 1, far: 110 });
    sun.shadow.normalBias = 0.045;
    sun.shadow.bias = -0.00015;
    scene.add(sun.target);
    scene.add(sun);
    const fill = new THREE.DirectionalLight("#d8deff", 0.7);
    fill.position.set(10, 5, -12);
    scene.add(fill);
    const scenery = createJourneyScenery();
    scene.add(scenery.group);
    const hero = createJourneyCharacter();
    scene.add(hero.group);
    const phone = createJourneyPhone();
    scene.add(phone.group);
    const contact = new THREE.Mesh(new THREE.CircleGeometry(0.65, 32), new THREE.MeshBasicMaterial({ color: "#6e8b74", transparent: true, opacity: 0.16, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.04;
    scene.add(contact);

    const portal = new THREE.Group();
    portal.position.set(0, 2.03, -4.62);
    scene.add(portal);
    const portalMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, opacity: { value: 0 } },
      vertexShader: `varying vec2 uvPosition; void main(){uvPosition=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec2 uvPosition; uniform float time; uniform float opacity;
        void main(){
          vec2 p=(uvPosition-0.5)*2.0; float radius=length(p); float angle=atan(p.y,p.x);
          float swirl=0.5+0.5*sin(angle*3.0-radius*16.0+time*3.0);
          vec3 color=mix(vec3(0.48,0.39,0.75),vec3(0.95,0.77,0.45),pow(swirl,3.0));
          color=mix(vec3(0.84,0.84,0.98),color,smoothstep(0.0,0.8,radius));
          gl_FragColor=vec4(color,(1.0-smoothstep(0.88,1.0,radius))*opacity);
        }`,
    });
    const portalDisc = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), portalMaterial);
    portal.add(portalDisc);
    const ringGeometry = new THREE.TorusGeometry(1, 0.032, 8, 72);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: "#ffe1a5", transparent: true, opacity: 0 });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.scale.set(1.43 + i * 0.14, 2.4 + i * 0.1, 1);
      ring.position.z = i * 0.03;
      portal.add(ring);
    }
    const stars = createStars(200, false);
    scene.add(stars.points);
    const burst = createStars(48, true);
    scene.add(burst.points);
    let lastElapsed = 0;
    let burstStarted = -100;
    let previousWidth = 0;
    let previousHeight = 0;
    let portraitDistance = 1;
    return {
      resize(width, height) {
        if (disposed || width <= 0 || height <= 0 || (width === previousWidth && height === previousHeight)) return;
        previousWidth = width;
        previousHeight = height;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5, 1280 / width);
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        stars.material.uniforms.pixelRatio.value = pixelRatio;
        burst.material.uniforms.pixelRatio.value = pixelRatio;
        camera.aspect = width / height;
        portraitDistance = Math.max(1, 1.04 / camera.aspect);
        camera.updateProjectionMatrix();
      },
      render(elapsed, pointerX, pointerY) {
        if (disposed || renderer.getContext().isContextLost()) return pose;
        lastElapsed = elapsed;
        sampleJourney(elapsed, pose);
        const driftX = pointerX * pose.cruise * 1.5;
        camera.position.set(pose.hero[0] + (pose.camera[0] - pose.hero[0]) * portraitDistance + driftX * 0.55,
          pose.camera[1] - pointerY * pose.cruise * 0.12,
          pose.hero[2] + (pose.camera[2] - pose.hero[2]) * portraitDistance);
        camera.lookAt(pose.target[0] + driftX * 0.7, pose.target[1], pose.target[2]);
        camera.rotateZ(pointerX * pose.cruise * 0.022);
        skyDome.position.copy(camera.position);
        hero.update(elapsed, pose, pointerX, pointerY);
        phone.update(elapsed, pose);
        scenery.update(elapsed, pose);
        contact.visible = elapsed < 4.2;
        contact.scale.setScalar(1 - smooth(4, 4.2, elapsed));
        const portalOpacity = smooth(3.9, 4.6, elapsed) * (1 - smooth(6.4, 6.7, elapsed));
        portal.visible = portalOpacity > 0;
        portalMaterial.uniforms.time.value = elapsed;
        portalMaterial.uniforms.opacity.value = portalOpacity;
        ringMaterial.opacity = portalOpacity * 0.8;
        portal.rotation.z = Math.sin(elapsed * 1.5) * 0.035;
        stars.points.visible = elapsed > 10;
        stars.points.position.set(pose.hero[0], pose.hero[1], pose.hero[2] - 1);
        stars.material.uniforms.time.value = elapsed;
        stars.material.uniforms.opacity.value = smooth(10, 12, elapsed) * (1 - pose.cruise * 0.65);
        const age = elapsed - burstStarted;
        burst.points.visible = age >= 0 && age < 1.25;
        burst.material.uniforms.time.value = elapsed;
        burst.material.uniforms.burstAge.value = age;
        burst.material.uniforms.opacity.value = Math.max(0, 1 - age / 1.25);
        renderer.render(scene, camera);
        return pose;
      },
      burst() {
        if (disposed || pose.stage !== "cruise") return;
        burstStarted = lastElapsed;
        burst.points.position.copy(hero.group.position);
        burst.points.position.y += 1.3;
        burst.points.position.z += 1;
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
