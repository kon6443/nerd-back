import * as THREE from "three";

export interface JourneyPalette {
  sky: string;
  sun: string;
  cloud: string;
  castleWall: string;
  castleRoof: string;
  treeLeaf: string;
  treeTrunk: string;
  gold: string;
  gem: string;
  phoneBody: string;
}

export const DEFAULT_PALETTE: JourneyPalette = {
  sky: "#7ec8e3",
  sun: "#fff2b2",
  cloud: "#ffffff",
  castleWall: "#f5eee6",
  castleRoof: "#e6739f",
  treeLeaf: "#88cc77",
  treeTrunk: "#a67c52",
  gold: "#ffc83b",
  gem: "#a78bfa",
  phoneBody: "#2d3748",
};

/** 1. 3D 스마트폰 모델 (셀카 & 화면) */
export function createPhoneModel(palette: JourneyPalette): THREE.Group {
  const group = new THREE.Group();

  // 폰 본체
  const bodyGeo = new THREE.BoxGeometry(1.6, 3.2, 0.12);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: palette.phoneBody,
    roughness: 0.3,
    metalness: 0.8,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // 화면 테두리 베젤
  const screenGeo = new THREE.PlaneGeometry(1.45, 2.95);
  // 화면 캔버스 텍스처 (동화풍 셀카 뷰파인더)
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  
  // 배경 그라데이션
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, "#bae6fd");
  grad.addColorStop(1, "#fbcfe8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 1024);

  // 셀카 주인공 아바타 실루엣
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(256, 420, 120, 0, Math.PI * 2); // 머리
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(256, 750, 190, 220, 0, 0, Math.PI * 2); // 어깨
  ctx.fill();

  // 귀여운 눈과 미소
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.arc(210, 420, 14, 0, Math.PI * 2);
  ctx.arc(302, 420, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(256, 460, 30, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#475569";
  ctx.lineCap = "round";
  ctx.stroke();

  // 볼터치
  ctx.fillStyle = "#f472b6";
  ctx.beginPath();
  ctx.arc(190, 455, 22, 0, Math.PI * 2);
  ctx.arc(322, 455, 22, 0, Math.PI * 2);
  ctx.fill();

  // 카메라 뷰파인더 모서리 가이드
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 10;
  // 좌상
  ctx.beginPath();
  ctx.moveTo(60, 120); ctx.lineTo(60, 60); ctx.lineTo(120, 60);
  ctx.stroke();
  // 우상
  ctx.beginPath();
  ctx.moveTo(392, 60); ctx.lineTo(452, 60); ctx.lineTo(452, 120);
  ctx.stroke();
  // 좌하
  ctx.beginPath();
  ctx.moveTo(60, 904); ctx.lineTo(60, 964); ctx.lineTo(120, 964);
  ctx.stroke();
  // 우하
  ctx.beginPath();
  ctx.moveTo(392, 964); ctx.lineTo(452, 964); ctx.lineTo(452, 904);
  ctx.stroke();

  // 셔터 버튼
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(256, 880, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 6;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: texture });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = 0.065;
  group.add(screen);

  // 상단 수화부 스피커
  const notchGeo = new THREE.BoxGeometry(0.3, 0.04, 0.02);
  const notchMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const notch = new THREE.Mesh(notchGeo, notchMat);
  notch.position.set(0, 1.4, 0.07);
  group.add(notch);

  return group;
}

/** 2. 몽글몽글 동화 성 (Castle) */
export function createCastleModel(palette: JourneyPalette): THREE.Group {
  const castle = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({
    color: palette.castleWall,
    roughness: 0.6,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: palette.castleRoof,
    roughness: 0.4,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: palette.gold,
    metalness: 0.6,
    roughness: 0.3,
  });

  // 메인 타워
  const mainTowerGeo = new THREE.CylinderGeometry(0.9, 1.1, 3.5, 12);
  const mainTower = new THREE.Mesh(mainTowerGeo, wallMat);
  mainTower.position.y = 1.75;
  castle.add(mainTower);

  const mainRoofGeo = new THREE.ConeGeometry(1.3, 2.2, 12);
  const mainRoof = new THREE.Mesh(mainRoofGeo, roofMat);
  mainRoof.position.y = 4.6;
  castle.add(mainRoof);

  // 꼭대기 황금 구체
  const goldTopGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const goldTop = new THREE.Mesh(goldTopGeo, goldMat);
  goldTop.position.y = 5.75;
  castle.add(goldTop);

  // 좌우 보조 타워
  [-1.5, 1.5].forEach((x) => {
    const subTowerGeo = new THREE.CylinderGeometry(0.5, 0.6, 2.5, 8);
    const subTower = new THREE.Mesh(subTowerGeo, wallMat);
    subTower.position.set(x, 1.25, 0.3);
    castle.add(subTower);

    const subRoofGeo = new THREE.ConeGeometry(0.7, 1.4, 8);
    const subRoof = new THREE.Mesh(subRoofGeo, roofMat);
    subRoof.position.set(x, 3.2, 0.3);
    castle.add(subRoof);
  });

  // 성문 (Arch)
  const gateGeo = new THREE.BoxGeometry(0.8, 1.2, 0.2);
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
  const gate = new THREE.Mesh(gateGeo, gateMat);
  gate.position.set(0, 0.6, 1.05);
  castle.add(gate);

  return castle;
}

/** 3. 몽글몽글 동화 나무 (Tree) */
export function createTreeModel(palette: JourneyPalette, scale = 1): THREE.Group {
  const tree = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({
    color: palette.treeTrunk,
    roughness: 0.8,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: palette.treeLeaf,
    roughness: 0.5,
  });

  // 기둥
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.8;
  tree.add(trunk);

  // 몽글몽글 잎사귀 클러스터 (3개의 둥근 형태 결합)
  const foliage = new THREE.Group();
  const c1Geo = new THREE.DodecahedronGeometry(0.85);
  const c1 = new THREE.Mesh(c1Geo, leafMat);
  c1.position.set(0, 2.1, 0);
  foliage.add(c1);

  const c2Geo = new THREE.DodecahedronGeometry(0.65);
  const c2 = new THREE.Mesh(c2Geo, leafMat);
  c2.position.set(-0.35, 1.8, 0.2);
  foliage.add(c2);

  const c3Geo = new THREE.DodecahedronGeometry(0.65);
  const c3 = new THREE.Mesh(c3Geo, leafMat);
  c3.position.set(0.35, 1.8, -0.2);
  foliage.add(c3);

  tree.add(foliage);
  tree.scale.setScalar(scale);

  return tree;
}

/** 3-1. 아기자기한 동화 버섯 (Mushroom) */
export function createMushroomModel(scale = 1): THREE.Group {
  const mushroom = new THREE.Group();

  const stemMat = new THREE.MeshStandardMaterial({
    color: 0xfff7ed,
    roughness: 0.6,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xef4444, // 빨간 버섯 갓
    roughness: 0.3,
  });
  const dotMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // 흰 반점
    roughness: 0.4,
  });

  const stemGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.5, 8);
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.25;
  mushroom.add(stem);

  const capGeo = new THREE.SphereGeometry(0.38, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 0.48;
  mushroom.add(cap);

  // 귀여운 흰 반점들
  [
    [0, 0.85, 0],
    [0.2, 0.72, 0.15],
    [-0.2, 0.72, -0.15],
    [0.15, 0.68, -0.2],
  ].forEach(([x, y, z]) => {
    const dotGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(x, y, z);
    mushroom.add(dot);
  });

  mushroom.scale.setScalar(scale);
  return mushroom;
}

/** 3-2. 반짝이는 파스텔 들꽃 (Flower) */
export function createFlowerModel(colorHex: number, scale = 1): THREE.Group {
  const flower = new THREE.Group();

  const stemMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.7 });
  const petalMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.3 });

  const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6);
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.2;
  flower.add(stem);

  // 꽃심
  const centerGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const center = new THREE.Mesh(centerGeo, centerMat);
  center.position.y = 0.42;
  flower.add(center);

  // 꽃잎 5개
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const petalGeo = new THREE.SphereGeometry(0.09, 6, 6);
    petalGeo.scale(1, 1.4, 0.6);
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.set(
      Math.cos(angle) * 0.16,
      0.42,
      Math.sin(angle) * 0.16
    );
    petal.rotation.y = angle;
    flower.add(petal);
  }

  flower.scale.setScalar(scale);
  return flower;
}

/** 4. 공중에 뜬 마법 등불 & 크리스탈 젬 */
export function createMagicLantern(palette: JourneyPalette): THREE.Group {
  const lantern = new THREE.Group();

  // 크리스탈 젬 코어 (Octahedron)
  const gemGeo = new THREE.OctahedronGeometry(0.35);
  const gemMat = new THREE.MeshStandardMaterial({
    color: palette.gem,
    emissive: palette.gem,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.4,
  });
  const gem = new THREE.Mesh(gemGeo, gemMat);
  lantern.add(gem);

  // 황금 링 장식
  const ringGeo = new THREE.TorusGeometry(0.55, 0.04, 8, 16);
  const ringMat = new THREE.MeshStandardMaterial({
    color: palette.gold,
    metalness: 0.7,
    roughness: 0.3,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 4;
  lantern.add(ring);

  // 부드러운 포인트 조명
  const light = new THREE.PointLight(palette.gem, 1.2, 5);
  lantern.add(light);

  return lantern;
}

/** 5. 3D 뭉게구름 덩어리 (Cloud) */
export function createCloudModel(palette: JourneyPalette, scale = 1): THREE.Group {
  const cloud = new THREE.Group();

  const cloudMat = new THREE.MeshStandardMaterial({
    color: palette.cloud,
    roughness: 0.9,
    metalness: 0.05,
    transparent: true,
    opacity: 0.94,
  });

  // 여러 크기의 구체를 겹쳐 볼륨감 있는 구름 형성
  const p1 = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), cloudMat);
  cloud.add(p1);

  const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6), cloudMat);
  p2.position.set(-0.85, -0.15, 0.1);
  cloud.add(p2);

  const p3 = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6), cloudMat);
  p3.position.set(0.85, -0.15, -0.1);
  cloud.add(p3);

  const p4 = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 6), cloudMat);
  p4.position.set(0.2, 0.45, 0.25);
  cloud.add(p4);

  cloud.scale.setScalar(scale);
  return cloud;
}

/** 6. 귀여운 미니 열기구 (Airship) */
export function createAirshipModel(palette: JourneyPalette): THREE.Group {
  const airship = new THREE.Group();

  // 풍선
  const balloonGeo = new THREE.SphereGeometry(1.2, 12, 10);
  balloonGeo.scale(1, 1.4, 1);
  const balloonMat = new THREE.MeshStandardMaterial({
    color: palette.gold,
    roughness: 0.4,
  });
  const balloon = new THREE.Mesh(balloonGeo, balloonMat);
  balloon.position.y = 2.0;
  airship.add(balloon);

  // 바구니
  const basketGeo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
  const basketMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
  const basket = new THREE.Mesh(basketGeo, basketMat);
  basket.position.y = 0.5;
  airship.add(basket);

  return airship;
}

/** 7. 마법 반딧불이 & 별빛 파티클 시스템 */
export function createSparkleParticles(count = 160): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const colorPalette = [
    new THREE.Color("#fef08a"), // 레몬골드
    new THREE.Color("#e9d5ff"), // 연보라
    new THREE.Color("#bae6fd"), // 하늘빛
    new THREE.Color("#fed7aa"), // 살구빛
  ];

  for (let i = 0; i < count; i++) {
    // 넓은 비행 통로 공간에 고루 배치
    positions[i * 3] = (Math.random() - 0.5) * 24;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 16 + 2;
    positions[i * 3 + 2] = -Math.random() * 80;

    const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.35,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}
