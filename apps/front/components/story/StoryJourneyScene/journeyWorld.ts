import * as THREE from "three";
import {
  createPhoneModel,
  createCastleModel,
  createTreeModel,
  createMushroomModel,
  createFlowerModel,
  createMagicLantern,
  createCloudModel,
  createAirshipModel,
  createSparkleParticles,
  createHeroModel,
  type HeroModel,
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

  // 하늘색 & 부드러운 안개 (구름이 묻히지 않도록 시작 45, 끝 160으로 확장)
  scene.background = new THREE.Color(palette.sky);
  scene.fog = new THREE.Fog(palette.sky, 45, 160);

  // 카메라 설정 (FOV 50)
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 140);
  camera.position.set(1.5, 1.45, 2.7);

  // 조명 설정
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(palette.sun, 2.2);
  sunLight.position.set(5, 12, 8);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.9);
  fillLight.position.set(-5, 6, -5);
  scene.add(fillLight);

  // ========================================================
  // 3인칭 주인공 캐릭터 (Hero Avatar)
  // ========================================================
  const hero: HeroModel = createHeroModel();
  hero.position.set(0.4, 0.45, 0.4);
  scene.add(hero);

  // ========================================================
  // 1단계: 스마트폰 (Z = 1.25 부근, 주인공을 마주보도록 배치)
  // ========================================================
  const phone = createPhoneModel(palette);
  phone.position.set(-0.35, 1.15, 1.25);
  phone.rotation.y = 0.35; // 주인공 쪽으로 살짝 비틈
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

  // 길가에 핀 귀여운 버섯들
  const mushroomCoords = [
    [-2.2, -15], [-2.8, -21], [-2.0, -29],
    [2.4, -16], [2.1, -24], [2.8, -31],
  ];
  mushroomCoords.forEach(([x, z]) => {
    const shroom = createMushroomModel(1.1);
    shroom.position.set(x, -0.5, z);
    landGroup.add(shroom);
  });

  // 알록달록 파스텔 들꽃들 (분홍, 노랑, 하늘빛)
  const flowerColors = [0xf472b6, 0xfde047, 0x67e8f9, 0xc084fc];
  const flowerCoords = [
    [-1.6, -13], [-1.8, -17], [-2.4, -25], [-1.5, -33],
    [1.7, -14], [1.9, -19], [1.6, -27], [2.0, -34],
  ];
  flowerCoords.forEach(([x, z], idx) => {
    const col = flowerColors[idx % flowerColors.length];
    const flower = createFlowerModel(col, 1.2);
    flower.position.set(x, -0.5, z);
    landGroup.add(flower);
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
  const cloudCount = 26;
  for (let i = 0; i < cloudCount; i++) {
    const scale = 2.0 + Math.random() * 2.4; // 큼직하고 몽글몽글한 순백 구름
    const c = createCloudModel(palette, scale);
    const x = (Math.random() - 0.5) * 36;
    const y = 1.0 + Math.random() * 5.5;
    const z = -50 - Math.random() * 75;
    c.position.set(x, y, z);
    cloudGroup.add(c);
    clouds.push({ mesh: c, baseZ: z, speed: 0.9 + Math.random() * 0.7 });
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

    // 1) 3인칭 스마트폰 셀카 (0 ~ 3.5초): 주인공이 폰을 향해 브이 포즈, 카메라는 3인칭 쿼터뷰
    if (elapsed < 3.5) {
      phone.visible = true;
      hero.visible = true;
      hero.setPose("selfie", elapsed);

      hero.position.set(0.4, 0.45 + Math.sin(elapsed * 2) * 0.03, 0.4);
      phone.position.set(-0.35, 1.15 + Math.sin(elapsed * 2.5) * 0.04, 1.25);
      phone.rotation.set(0.08, 0.35 + Math.sin(elapsed * 1.5) * 0.05, -0.05);

      camera.position.set(1.5, 1.45, 2.7);
      camera.lookAt(0.05, 1.05, 0.85);

      // 2.4초에 "찰칵!" 플래시 트리거
      if (elapsed >= 2.4 && !flashTriggered) {
        flashTriggered = true;
        onFlash?.(true);
        setTimeout(() => onFlash?.(false), 280);
      }
    }
    // 2) 3인칭 스마트폰 화면 다이브! (3.5 ~ 6.5초): 주인공이 폰 화면 속으로 슝 다이빙, 카메라가 추격
    else if (elapsed < 6.5) {
      phone.visible = true;
      hero.visible = true;
      hero.setPose("dive", elapsed);

      const progress = (elapsed - 3.5) / 3.0; // 0 ~ 1
      const ease = progress * progress * (3 - 2 * progress); // smoothstep

      // 주인공이 스마트폰 화면 속으로 다이빙
      const heroX = THREE.MathUtils.lerp(0.4, -0.35, ease);
      const heroY = THREE.MathUtils.lerp(0.45, 1.15, ease);
      const heroZ = THREE.MathUtils.lerp(0.4, -3.5, ease);
      hero.position.set(heroX, heroY, heroZ);

      // 스마트폰 화면 포탈 확대
      phone.scale.setScalar(1 + ease * 2.8);
      phone.rotation.z = ease * 0.35;

      // 카메라가 주인공을 뒤쫓아 폰 스크린 속으로 진입
      const camX = THREE.MathUtils.lerp(1.5, -0.35, ease);
      const camY = THREE.MathUtils.lerp(1.45, 1.55, ease);
      const camZ = THREE.MathUtils.lerp(2.7, -0.5, ease);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(heroX, heroY, heroZ - 3);
    }
    // 3) 3인칭 성과 나무 숲길 플라이스루 (6.5 ~ 12.0초): 주인공이 망토를 휘날리며 활강, 체이스캠
    else if (elapsed < 12.0) {
      phone.visible = false;
      hero.visible = true;
      hero.setPose("fly", elapsed);

      const progress = (elapsed - 6.5) / 5.5; // 0 ~ 1
      const ease = progress * progress * (3 - 2 * progress);

      const heroZ = THREE.MathUtils.lerp(-3.5, -34.0, ease);
      const heroY = 1.6 + Math.sin(progress * Math.PI) * 2.2;
      const heroX = Math.sin(progress * Math.PI * 1.5) * 1.6;
      hero.position.set(heroX, heroY, heroZ);
      hero.setBank(-Math.cos(progress * Math.PI * 1.5) * 0.4);

      // 3인칭 체이스캠 (주인공 뒤쪽 상단에서 추격)
      const camX = heroX * 0.7;
      const camY = heroY + 1.2;
      const camZ = heroZ + 3.8;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(heroX, heroY + 0.2, heroZ - 4.5);
    }
    // 4) 3인칭 마법 등불 & 크리스탈 터널 통과 (12.0 ~ 16.0초): 구름 위로 솟구침
    else if (elapsed < 16.0) {
      phone.visible = false;
      hero.visible = true;
      hero.setPose("fly", elapsed);

      const progress = (elapsed - 12.0) / 4.0; // 0 ~ 1
      const ease = progress * progress * (3 - 2 * progress);

      const heroZ = THREE.MathUtils.lerp(-34.0, -62.0, ease);
      const heroY = THREE.MathUtils.lerp(3.8, 6.2, ease);
      const heroX = Math.sin(progress * Math.PI * 2) * 1.2;
      hero.position.set(heroX, heroY, heroZ);
      hero.setBank(-Math.cos(progress * Math.PI * 2) * 0.35);

      // 3인칭 체이스캠
      camera.position.set(heroX * 0.6, heroY + 1.2, heroZ + 3.8);
      camera.lookAt(heroX, heroY + 0.2, heroZ - 5.0);
    }
    // 5) 3인칭 구름 서핑 & 무한 순항 모드 (16초 이후 ~ 무한 루프): 주인공이 꼬마 구름을 타고 비행
    else {
      phone.visible = false;
      hero.visible = true;
      const cruiseTime = elapsed - 16.0;
      hero.setPose("fly", cruiseTime);

      // 구름 위 파도타기 비행 호흡
      const floatY = 6.0 + Math.sin(cruiseTime * 0.85) * 0.45;
      const targetHeroX = pointerX * 2.4;
      hero.position.x = THREE.MathUtils.lerp(hero.position.x, targetHeroX, 0.08);
      hero.position.y = THREE.MathUtils.lerp(hero.position.y, floatY + pointerY * 0.8, 0.08);
      hero.position.z = -65.0;
      hero.setBank(-pointerX * 0.45 + Math.sin(cruiseTime * 0.6) * 0.05);

      // 3인칭 오버더숄더 / 체이스 카메라
      const camX = THREE.MathUtils.lerp(camera.position.x, hero.position.x * 0.6, 0.06);
      const camY = THREE.MathUtils.lerp(camera.position.y, hero.position.y + 1.25, 0.06);
      const camZ = -60.8; // 주인공 뒤 4.2 거리
      camera.position.set(camX, camY, camZ);
      camera.lookAt(hero.position.x, hero.position.y + 0.1, -85.0);

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
    renderer.setSize(width, height, true);
  }

  function dispose() {
    renderer.dispose();

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
