import * as THREE from "three";
import {
  createPhoneModel,
  createCastleModel,
  createTreeModel,
  createMagicLantern,
  createCloudModel,
  createAirshipModel,
  createSparkleParticles,
  DEFAULT_PALETTE,
  type JourneyPalette,
} from "./journeyObjects";

export interface JourneyWorld {
  render: (pointerX: number, pointerY: number) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createJourneyWorld(
  canvas: HTMLCanvasElement,
  onFlash?: (active: boolean) => void,
): JourneyWorld {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "default",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const palette: JourneyPalette = { ...DEFAULT_PALETTE };

  // 하늘색 & 부드러운 안개
  scene.background = new THREE.Color(palette.sky);
  scene.fog = new THREE.Fog(palette.sky, 15, 75);

  // 카메라 설정 (FOV 50)
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
  camera.position.set(0, 1.2, 3.2);

  // 조명 설정
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(palette.sun, 2.0);
  sunLight.position.set(5, 12, 8);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.8);
  fillLight.position.set(-5, 6, -5);
  scene.add(fillLight);

  // ========================================================
  // 1단계: 스마트폰 (Z = 0 부근)
  // ========================================================
  const phone = createPhoneModel(palette);
  phone.position.set(0, 1.2, 0);
  scene.add(phone);

  // ========================================================
  // 2단계: 동화 나라 지형, 성, 나무들 (Z = -12 ~ -38)
  // ========================================================
  const landGroup = new THREE.Group();
  scene.add(landGroup);

  // 초록 잔디 바닥
  const groundGeo = new THREE.PlaneGeometry(80, 80);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x98d878,
    roughness: 0.9,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.5, -28);
  landGroup.add(ground);

  // 성 (Z = -26, 정면 중앙에서 살짝 우측)
  const castle = createCastleModel(palette);
  castle.position.set(2.5, -0.5, -26);
  landGroup.add(castle);

  // 도열한 동화 나무들 (좌우 숲길)
  const treePositions = [
    [-3.5, -14], [-4.2, -18], [-3.8, -23], [-5.0, -28], [-4.2, -34],
    [3.8, -14], [4.5, -18], [5.2, -22], [3.9, -32], [5.5, -36],
    [-2.2, -36], [-1.0, -38], [1.5, -37],
  ];
  treePositions.forEach(([x, z], i) => {
    const scale = 0.85 + (i % 3) * 0.2;
    const tree = createTreeModel(palette, scale);
    tree.position.set(x, -0.5, z);
    landGroup.add(tree);
  });

  // ========================================================
  // 3단계: 마법 등불 & 크리스탈 젬 터널 (Z = -38 ~ -55)
  // ========================================================
  const lanternGroup = new THREE.Group();
  scene.add(lanternGroup);

  const lanterns: THREE.Group[] = [];
  const lanternCoords = [
    [-2.2, 2.0, -40], [2.2, 2.5, -42],
    [-1.8, 3.2, -45], [1.9, 1.8, -48],
    [-2.5, 2.8, -51], [2.0, 3.5, -53],
  ];
  lanternCoords.forEach(([x, y, z]) => {
    const l = createMagicLantern(palette);
    l.position.set(x, y, z);
    lanternGroup.add(l);
    lanterns.push(l);
  });

  // 별빛 파티클
  const sparkles = createSparkleParticles(200);
  scene.add(sparkles);

  // ========================================================
  // 4단계: 무한 구름 바다 (Z = -55 ~ -110)
  // ========================================================
  const cloudGroup = new THREE.Group();
  scene.add(cloudGroup);

  const clouds: { mesh: THREE.Group; baseZ: number; speed: number }[] = [];
  const cloudCount = 18;
  for (let i = 0; i < cloudCount; i++) {
    const scale = 1.6 + Math.random() * 1.8;
    const c = createCloudModel(palette, scale);
    const x = (Math.random() - 0.5) * 28;
    const y = 2.0 + Math.random() * 4.5;
    const z = -55 - Math.random() * 55;
    c.position.set(x, y, z);
    cloudGroup.add(c);
    clouds.push({ mesh: c, baseZ: z, speed: 0.8 + Math.random() * 0.6 });
  }

  // 저 멀리 떠 있는 열기구
  const airship = createAirshipModel(palette);
  airship.position.set(-6, 7.5, -75);
  scene.add(airship);

  // ========================================================
  // 애니메이션 & 카메라 타임라인
  // ========================================================
  const clock = new THREE.Clock();
  let flashTriggered = false;

  function render(pointerX: number, pointerY: number) {
    const elapsed = clock.getElapsedTime();

    // 1) 스마트폰 셀카 & 호흡 (0 ~ 3.5초)
    if (elapsed < 3.5) {
      phone.visible = true;
      phone.position.y = 1.2 + Math.sin(elapsed * 2.5) * 0.05;
      phone.rotation.y = Math.sin(elapsed * 1.5) * 0.08;
      camera.position.set(0, 1.2, 3.2);
      camera.lookAt(0, 1.2, 0);

      // 2.5초에 "찰칵!" 플래시 트리거
      if (elapsed >= 2.4 && !flashTriggered) {
        flashTriggered = true;
        onFlash?.(true);
        setTimeout(() => onFlash?.(false), 280);
      }
    }
    // 2) 스마트폰 화면 속으로 쑥 다이브! (3.5 ~ 6.5초)
    else if (elapsed < 6.5) {
      phone.visible = true;
      const progress = (elapsed - 3.5) / 3.0; // 0 ~ 1
      const ease = progress * progress * (3 - 2 * progress); // smoothstep
      // 카메라가 스마트폰 스크린(0, 1.2, 0.06)을 뚫고 통과
      const camZ = THREE.MathUtils.lerp(3.2, -3.5, ease);
      camera.position.set(0, 1.2, camZ);
      camera.lookAt(0, 1.2, camZ - 10);

      phone.scale.setScalar(1 + ease * 2.5);
      phone.rotation.z = ease * 0.3;
    }
    // 3) 성과 나무 숲길 플라이스루 (6.5 ~ 12.0초)
    else if (elapsed < 12.0) {
      phone.visible = false;
      const progress = (elapsed - 6.5) / 5.5; // 0 ~ 1
      const ease = progress * progress * (3 - 2 * progress);
      const camZ = THREE.MathUtils.lerp(-3.5, -34.0, ease);
      // 아치형으로 살짝 낮아졌다가 성문 위로 솟구침
      const camY = 1.2 + Math.sin(progress * Math.PI) * 1.8;
      const camX = Math.sin(progress * Math.PI * 1.5) * 1.2;

      camera.position.set(camX, camY, camZ);
      camera.lookAt(0, camY * 0.8, camZ - 12);
    }
    // 4) 마법 등불 & 크리스탈 터널 (12.0 ~ 16.0초)
    else if (elapsed < 16.0) {
      phone.visible = false;
      const progress = (elapsed - 12.0) / 4.0; // 0 ~ 1
      const ease = progress * progress * (3 - 2 * progress);
      const camZ = THREE.MathUtils.lerp(-34.0, -56.0, ease);
      const camY = THREE.MathUtils.lerp(3.0, 5.2, ease); // 구름 위로 솟구치기 시작

      camera.position.set(0, camY, camZ);
      camera.lookAt(0, camY, camZ - 12);
    }
    // 5) 구름을 타고 여행하는 순항 모드 (16초 이후 ~ 무한 루프)
    else {
      phone.visible = false;
      const cruiseTime = elapsed - 16.0;

      // 구름 위에서 파도를 타듯 유유히 떠오르고 내리는 비행 호흡 (Floating)
      const floatY = 5.6 + Math.sin(cruiseTime * 0.8) * 0.45;
      const rollZ = Math.sin(cruiseTime * 0.6) * 0.03;

      // 포인터(마우스/터치) 반응형 시점 패럴랙스
      const targetX = pointerX * 1.8;
      const targetY = floatY + pointerY * 0.8;

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.06);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.06);
      camera.position.z = -58.0;

      camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, -pointerX * 0.08 + rollZ, 0.06);
      camera.lookAt(targetX * 0.6, floatY, -78.0);

      // 열기구 유유히 부유
      airship.position.y = 7.5 + Math.sin(cruiseTime * 0.5) * 0.8;
      airship.position.x = -6.0 + Math.cos(cruiseTime * 0.3) * 1.2;
    }

    // 마법 등불 회전 및 반짝임
    lanterns.forEach((l, idx) => {
      l.rotation.y = elapsed * 1.2 + idx;
      l.rotation.x = Math.sin(elapsed * 2 + idx) * 0.2;
    });

    // 별빛 파티클 미세 유동
    sparkles.rotation.z = elapsed * 0.04;

    // 구름들 무한 이동 루프 (카메라를 향해 흘러오며 순항 느낌 연출)
    clouds.forEach((item) => {
      // 16초 이전에도 은은히 흐르고, 16초 순항 시 본격 비행감 제공
      const speed = elapsed >= 16.0 ? item.speed * 3.5 : item.speed;
      item.mesh.position.z += speed * 0.08;
      // 카메라 뒤로 지나치면 다시 저 먼 곳(-110)으로 순환
      if (item.mesh.position.z > -45) {
        item.mesh.position.z = -110;
        item.mesh.position.x = (Math.random() - 0.5) * 32;
      }
    });

    renderer.render(scene, camera);
  }

  function resize(width: number, height: number) {
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function dispose() {
    renderer.dispose();
    renderer.forceContextLoss();

    // 씬 내 모든 지오메트리 & 머티리얼 정리
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
  }

  return {
    render,
    resize,
    dispose,
  };
}
