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
export interface PhoneModel extends THREE.Group {
  updateScreen: (elapsed: number) => void;
  portalRings: THREE.Group;
}

/** 1. 3D 스마트폰 모델 (셀카 카운트다운 & 마법 포탈) */
export function createPhoneModel(palette: JourneyPalette): PhoneModel {
  const group = new THREE.Group() as PhoneModel;

  // 폰 본체 (슬림한 둥근 모서리 스마트폰)
  const bodyGeo = new THREE.BoxGeometry(1.6, 3.2, 0.12);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: palette.phoneBody,
    roughness: 0.25,
    metalness: 0.85,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // 뒷면 카메라 섬 (Triple Camera)
  const cameraBumpGeo = new THREE.BoxGeometry(0.65, 0.65, 0.05);
  const cameraBumpMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.2,
    metalness: 0.9,
  });
  const cameraBump = new THREE.Mesh(cameraBumpGeo, cameraBumpMat);
  cameraBump.position.set(-0.35, 1.15, -0.08);
  group.add(cameraBump);

  // 3개의 카메라 렌즈
  const lensGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12);
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1, metalness: 0.95 });
  [
    [-0.45, 1.25],
    [-0.25, 1.25],
    [-0.35, 1.05],
  ].forEach(([lx, ly]) => {
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(lx, ly, -0.11);
    group.add(lens);
  });

  // 화면 테두리 베젤
  const screenGeo = new THREE.PlaneGeometry(1.46, 2.96);
  // 화면 캔버스 텍스처 (동적 뷰파인더 & 카운트다운)
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const screenMat = new THREE.MeshBasicMaterial({ map: texture });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = 0.065;
  group.add(screen);

  // 상단 수화부 스피커
  const notchGeo = new THREE.BoxGeometry(0.3, 0.04, 0.02);
  const notchMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const notch = new THREE.Mesh(notchGeo, notchMat);
  notch.position.set(0, 1.4, 0.07);
  group.add(notch);

  // 스마트폰 주변에 펼쳐지는 마법 포탈 링들
  const portalRings = new THREE.Group();
  portalRings.visible = false;
  group.add(portalRings);
  group.portalRings = portalRings;

  const ring1Geo = new THREE.TorusGeometry(1.8, 0.05, 12, 32);
  const ring1Mat = new THREE.MeshStandardMaterial({
    color: 0xfde047, // 황금빛
    emissive: 0xfde047,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });
  const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
  portalRings.add(ring1);

  const ring2Geo = new THREE.TorusGeometry(2.1, 0.04, 12, 32);
  const ring2Mat = new THREE.MeshStandardMaterial({
    color: 0xc084fc, // 보랏빛
    emissive: 0xc084fc,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });
  const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
  portalRings.add(ring2);

  // 화면 실시간 드로잉
  group.updateScreen = (elapsed: number) => {
    ctx.clearRect(0, 0, 512, 1024);

    if (elapsed < 3.5) {
      portalRings.visible = false;
      // 1) 셀카 뷰파인더 모드 (화사한 파스텔 배경 + 아바타 + 카운트다운)
      const grad = ctx.createLinearGradient(0, 0, 0, 1024);
      grad.addColorStop(0, "#bae6fd");
      grad.addColorStop(1, "#fbcfe8");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 1024);

      // 주인공 실루엣 호흡
      const breathe = Math.sin(elapsed * 3) * 8;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(256, 420 + breathe, 120, 0, Math.PI * 2); // 머리
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(256, 750 + breathe, 190, 220, 0, 0, Math.PI * 2); // 어깨
      ctx.fill();

      // 귀여운 눈 (2.0초에 윙크!)
      ctx.fillStyle = "#475569";
      if (elapsed >= 1.8 && elapsed < 2.3) {
        // 윙크 (왼눈 감음, 오른눈 뜸)
        ctx.beginPath();
        ctx.arc(210, 420 + breathe, 14, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#475569";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(302, 420 + breathe, 14, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(210, 420 + breathe, 14, 0, Math.PI * 2);
        ctx.arc(302, 420 + breathe, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // 미소 & 볼터치
      ctx.beginPath();
      ctx.arc(256, 460 + breathe, 30, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#475569";
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.arc(190, 455 + breathe, 22, 0, Math.PI * 2);
      ctx.arc(322, 455 + breathe, 22, 0, Math.PI * 2);
      ctx.fill();

      // 카메라 뷰파인더 코너 라인
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(50, 100); ctx.lineTo(50, 50); ctx.lineTo(100, 50);
      ctx.moveTo(412, 50); ctx.lineTo(462, 50); ctx.lineTo(462, 100);
      ctx.moveTo(50, 924); ctx.lineTo(50, 974); ctx.lineTo(100, 974);
      ctx.moveTo(412, 974); ctx.lineTo(462, 974); ctx.lineTo(462, 924);
      ctx.stroke();

      // 상단 카운트다운 타이머 배지 (3.. 2.. 1.. 찰칵!)
      let countText = "3 찰칵 준비!";
      let badgeColor = "#3b82f6";
      if (elapsed >= 1.0 && elapsed < 1.8) {
        countText = "2 쁘이~ ✌️";
        badgeColor = "#8b5cf6";
      } else if (elapsed >= 1.8 && elapsed < 2.4) {
        countText = "1 치즈! 🧀";
        badgeColor = "#ec4899";
      } else if (elapsed >= 2.4) {
        countText = "✨ 찰칵! ✨";
        badgeColor = "#f59e0b";
      }

      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.roundRect(146, 75, 220, 56, 28);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(countText, 256, 113);
    } else {
      // 2) 마법 포탈 워프 모드 (3.5 ~ 6.5초): 황금빛 & 보랏빛 소용돌이
      portalRings.visible = true;
      const portalTime = elapsed - 3.5;
      ring1.rotation.z = portalTime * 2.5;
      ring2.rotation.z = -portalTime * 2.0;

      // 포탈 소용돌이 그라데이션
      const cx = 256;
      const cy = 512;
      const radial = ctx.createRadialGradient(cx, cy, 30, cx, cy, 500);
      radial.addColorStop(0, "#ffffff");
      radial.addColorStop(0.25, "#fde047");
      radial.addColorStop(0.55, "#a855f7");
      radial.addColorStop(0.85, "#3b82f6");
      radial.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, 512, 1024);

      // 소용돌이 스파이럴 라인
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(portalTime * 4.0);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 12;
      for (let i = 0; i < 4; i++) {
        ctx.rotate((Math.PI / 2));
        ctx.beginPath();
        ctx.arc(0, 0, 160 + i * 40, 0, Math.PI * 0.85);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✨ 동화 속으로 다이브! ✨", 256, 525);
    }

    texture.needsUpdate = true;
  };

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

/** 5. 3D 뭉게구름 덩어리 (Cloud) - 순백색의 뽀얗고 화사한 구름 */
export function createCloudModel(palette: JourneyPalette, scale = 1): THREE.Group {
  const cloud = new THREE.Group();

  // 그림자 속에서도 칙칙해지지 않는 눈부신 순백 머티리얼
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.22,
    roughness: 0.15,
    metalness: 0.0,
    transparent: false,
    opacity: 1.0,
  });

  // 볼륨감 넘치는 5개의 둥근 구체 클러스터
  const p1 = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 10), cloudMat);
  cloud.add(p1);

  const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), cloudMat);
  p2.position.set(-0.95, -0.1, 0.15);
  cloud.add(p2);

  const p3 = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), cloudMat);
  p3.position.set(0.95, -0.1, -0.15);
  cloud.add(p3);

  const p4 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), cloudMat);
  p4.position.set(0.25, 0.55, 0.3);
  cloud.add(p4);

  const p5 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), cloudMat);
  p5.position.set(-0.35, 0.45, -0.25);
  cloud.add(p5);

  cloud.scale.setScalar(scale);
  return cloud;
}

/** 5-1. 주인공이 타고 날아가는 꼬마 마법 구름 (Magic Cloud Board) */
export function createMagicCloudBoard(): THREE.Group {
  const board = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.3,
    roughness: 0.1,
  });

  // 서핑 보드처럼 유선형으로 겹친 구름들
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 8), cloudMat);
  center.scale.set(1.4, 0.4, 0.85);
  board.add(center);

  const front = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), cloudMat);
  front.position.set(0, 0.05, -0.7);
  front.scale.set(1.1, 0.4, 0.9);
  board.add(front);

  const back = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), cloudMat);
  back.position.set(0, 0.08, 0.65);
  back.scale.set(1.2, 0.45, 0.9);
  board.add(back);

  return board;
}

export interface HeroModel extends THREE.Group {
  setPose: (mode: "selfie" | "dive" | "fly", t?: number) => void;
  setBank: (tilt: number) => void;
  magicCloud: THREE.Group;
}

/** 5-2. 3인칭 주인공 캐릭터 모델 (Hero Avatar) */
export function createHeroModel(): HeroModel {
  const hero = new THREE.Group() as HeroModel;

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffddb8, roughness: 0.5 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x5a3825, roughness: 0.6 });
  const clothesMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 }); // 파란 옷
  const capeMat = new THREE.MeshStandardMaterial({
    color: 0xef4444, // 빨간 망토
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  const faceMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });

  // 1. 머리 (Head)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.1, 0);
  hero.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), skinMat);
  headGroup.add(headMesh);

  // 헤어 (둥근 반구 + 앞머리 볼륨)
  const hairGeo = new THREE.SphereGeometry(0.38, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const hairMesh = new THREE.Mesh(hairGeo, hairMat);
  hairMesh.position.y = 0.02;
  headGroup.add(hairMesh);

  // 귀여운 눈
  [-0.12, 0.12].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), faceMat);
    eye.position.set(x, 0.02, 0.32);
    headGroup.add(eye);
  });

  // 발그레한 볼터치
  [-0.18, 0.18].forEach((x) => {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), blushMat);
    blush.position.set(x, -0.06, 0.3);
    headGroup.add(blush);
  });

  // 2. 몸통 (Body)
  const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 8), clothesMat);
  bodyMesh.position.set(0, 0.65, 0);
  hero.add(bodyMesh);

  // 3. 펄럭이는 마법 망토 (Cape)
  const capeGeo = new THREE.PlaneGeometry(0.45, 0.6, 3, 3);
  const cape = new THREE.Mesh(capeGeo, capeMat);
  cape.position.set(0, 0.65, -0.22);
  cape.rotation.x = 0.2;
  hero.add(cape);

  // 4. 좌우 팔 (Arms)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.28, 0.82, 0);
  hero.add(leftArmPivot);
  const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.38, 6), clothesMat);
  leftArmMesh.position.set(0, -0.18, 0);
  leftArmPivot.add(leftArmMesh);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.28, 0.82, 0);
  hero.add(rightArmPivot);
  const rightArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.38, 6), clothesMat);
  rightArmMesh.position.set(0, -0.18, 0);
  rightArmPivot.add(rightArmMesh);

  // 5. 다리 (Legs)
  const legsGroup = new THREE.Group();
  legsGroup.position.set(0, 0.4, 0);
  hero.add(legsGroup);
  [-0.1, 0.1].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.4, 6), clothesMat);
    leg.position.set(x, -0.2, 0);
    legsGroup.add(leg);
  });

  // 6. 탑승형 꼬마 마법 구름 보드
  const magicCloud = createMagicCloudBoard();
  magicCloud.position.set(0, -0.05, 0);
  magicCloud.visible = false;
  hero.add(magicCloud);
  hero.magicCloud = magicCloud;

  // 머리 그룹 노출
  (hero as unknown as { headGroup: THREE.Group }).headGroup = headGroup;

  // 포즈 제어
  hero.setPose = (mode, t = 0) => {
    if (mode === "selfie") {
      magicCloud.visible = false;
      hero.scale.set(1, 1, 1);
      hero.rotation.x = 0;
      hero.rotation.y = -0.28; // 폰을 향해 몸을 틈
      hero.rotation.z = Math.sin(t * 2.5) * 0.04;

      // 머리 귀엽게 갸우뚱
      headGroup.rotation.z = Math.sin(t * 3.0) * 0.12;
      headGroup.rotation.y = -0.15 + Math.sin(t * 1.8) * 0.06;

      // 오른손은 폰 모서리를 잡고, 왼손은 신나는 브이 포즈
      rightArmPivot.rotation.x = -Math.PI / 2.3;
      rightArmPivot.rotation.y = -0.2;
      rightArmPivot.rotation.z = -0.15;

      leftArmPivot.rotation.x = -Math.PI / 2.4;
      leftArmPivot.rotation.y = 0.2;
      leftArmPivot.rotation.z = 0.5 + Math.sin(t * 4) * 0.08;

      cape.rotation.x = 0.15 + Math.sin(t * 3) * 0.06;
    } else if (mode === "dive") {
      magicCloud.visible = false;
      // t는 0 ~ 1 사이의 다이빙 진행률
      if (t < 0.22) {
        // [예비 동작 Anticipation] 화면이 열리며 뒤로 살짝 젖혀짐
        hero.rotation.x = -0.25;
        hero.rotation.y = 0;
        hero.scale.set(1.1, 0.9, 1.1); // 살짝 웅크림
        leftArmPivot.rotation.x = -0.3;
        leftArmPivot.rotation.z = 0.6;
        rightArmPivot.rotation.x = -0.3;
        rightArmPivot.rotation.z = -0.6;
        headGroup.rotation.z = 0;
      } else {
        // [본격 다이빙 Elastic Stretch] 머리부터 화면 속으로 쑥 다이빙
        const diveEase = (t - 0.22) / 0.78;
        hero.rotation.x = Math.PI / 2.15;
        hero.rotation.y = 0;
        // 회전 스핀하며 웜홀 통과
        hero.rotation.z = diveEase * Math.PI * 2.0;
        // 속도감 있는 스트레치
        hero.scale.set(0.85, 1.3, 0.85);

        // 양팔을 앞으로 모으고 다이빙
        leftArmPivot.rotation.x = -Math.PI * 0.95;
        leftArmPivot.rotation.z = -0.1;
        rightArmPivot.rotation.x = -Math.PI * 0.95;
        rightArmPivot.rotation.z = 0.1;
        cape.rotation.x = -0.6 + Math.sin(t * 20) * 0.15; // 거센 바람에 펄럭임
      }
    } else {
      // fly (비행 & 구름 서핑)
      magicCloud.visible = true;
      hero.scale.set(1, 1, 1);
      headGroup.rotation.set(0, 0, 0);
      hero.rotation.x = 0.22; // 날아가는 살짝 숙인 포즈
      hero.rotation.y = 0;
      leftArmPivot.rotation.x = -0.5;
      leftArmPivot.rotation.z = 0.82; // 양팔 시원하게 벌림
      rightArmPivot.rotation.x = -0.5;
      rightArmPivot.rotation.z = -0.82;
      cape.rotation.x = 0.75 + Math.sin(t * 6) * 0.15;
    }
  };

  hero.setBank = (tilt) => {
    hero.rotation.z = tilt;
  };

  return hero;
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
