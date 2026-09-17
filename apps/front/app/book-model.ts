import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type BookPalette = {
  paper: string;
  edge: string;
  cover: string;
  coverDark: string;
  leaf: string;
  gold: string;
  sky: string;
  rose: string;
};

/** 홈의 3D 오브젝트. 외부 모델/텍스처 없이 곡면·두께·그림자가 있는 메시로 만든다. */
export function createBookModel(palette: BookPalette) {
  const book = new THREE.Group();
  const color = (a: string, b: string, blend: number) => new THREE.Color(a).lerp(new THREE.Color(b), blend);
  const material = (value: THREE.ColorRepresentation) => new THREE.MeshStandardMaterial({ color: value, roughness: 0.85, metalness: 0 });
  const paper = material(palette.paper);
  const edge = material(color(palette.edge, palette.paper, 0.45));
  const cover = material(palette.cover);
  const coverDark = material(palette.coverDark);
  const foliage = material(color(palette.leaf, palette.cover, 0.38));
  const foliageLight = material(color(palette.leaf, palette.paper, 0.3));
  const bark = material(color(palette.edge, palette.coverDark, 0.36));
  const roof = material(color(palette.sky, palette.cover, 0.75).lerp(new THREE.Color(palette.paper), 0.12));
  const gold = material(color(palette.gold, palette.edge, 0.65));
  gold.roughness = 0.75;
  const water = material(color(palette.sky, palette.paper, 0.38));
  const meadow = material(color(palette.leaf, palette.paper, 0.5));
  const rose = material(color(palette.rose, palette.cover, 0.18));
  const windowLight = material(color(palette.gold, palette.paper, 0.7));
  windowLight.emissive.set(palette.gold);
  windowLight.emissiveIntensity = 0.16;
  const pathMaterial = material(color(palette.edge, palette.gold, 0.12));
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const detailSphere = new THREE.SphereGeometry(1, 8, 6);
  const trunk = new THREE.CylinderGeometry(0.04, 0.065, 0.6, 8);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 16);
  // 이 모델 안에서만 공유한다. 이탈 시 book-world의 geometry Set이 한 번씩 해제한다.
  const roundedBoxes = new Map<string, RoundedBoxGeometry>();
  const arches = new Map<string, THREE.ExtrudeGeometry>();

  function mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, surface: THREE.Material, x: number, y: number, z: number) {
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function box(parent: THREE.Group, width: number, height: number, depth: number, surface: THREE.Material, x: number, y: number, z: number, radius = 0.05) {
    const key = `${width},${height},${depth},${radius}`;
    let geometry = roundedBoxes.get(key);
    if (!geometry) {
      geometry = new RoundedBoxGeometry(width, height, depth, 2, radius);
      roundedBoxes.set(key, geometry);
    }
    return mesh(parent, geometry, surface, x, y, z);
  }

  function ball(parent: THREE.Group, surface: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) {
    const geometry = Math.max(sx, sy, sz) <= 0.065 ? detailSphere : sphere;
    const object = mesh(parent, geometry, surface, x, y, z);
    object.scale.set(sx, sy, sz);
    return object;
  }

  function column(parent: THREE.Group, surface: THREE.Material, x: number, y: number, z: number, radius: number, height: number) {
    const object = mesh(parent, cylinder, surface, x, y, z);
    object.scale.set(radius, height, radius);
    return object;
  }

  const pageHeight = (x: number) => {
    const t = Math.min(1, Math.max(0, (Math.abs(x) - 0.055) / 3.12));
    return 0.47 + 0.28 * Math.sin(Math.PI * t) - 0.16 * Math.exp(-t * 13);
  };

  // 단면 곡선을 책 깊이 방향으로 돌출시켜 윗면과 옆면이 같은 곡률을 갖게 한다.
  const pageShape = new THREE.Shape();
  pageShape.moveTo(0.055, 0.2);
  pageShape.lineTo(3.175, 0.2);
  for (let i = 40; i >= 0; i--) {
    const x = 0.055 + 3.12 * i / 40;
    pageShape.lineTo(x, pageHeight(x));
  }
  pageShape.closePath();
  const pagesGeometry = new THREE.ExtrudeGeometry(pageShape, { depth: 4.15, steps: 1, bevelEnabled: false });

  for (const side of [-1, 1]) {
    box(book, 3.4, 0.18, 4.5, cover, side * 1.67, 0.08, 0, 0.085);
    const pages = new THREE.Mesh(pagesGeometry, [edge, paper]);
    pages.position.z = -2.075;
    pages.scale.x = side;
    pages.castShadow = true;
    pages.receiveShadow = true;
    book.add(pages);
  }
  box(book, 0.22, 0.2, 4.5, coverDark, 0, 0.1, 0, 0.08);
  box(book, 0.06, 0.09, 4.12, coverDark, 0, 0.255, 0, 0.02);

  const coverFoil: number[] = [];
  for (const side of [-1, 1]) {
    const corners = [[side * 0.14, 0.176, -2.18], [side * 3.29, 0.176, -2.18], [side * 3.29, 0.176, 2.18], [side * 0.14, 0.176, 2.18]];
    corners.forEach((point, i) => coverFoil.push(...point, ...corners[(i + 1) % corners.length]));
  }
  const foilGeometry = new THREE.BufferGeometry();
  foilGeometry.setAttribute("position", new THREE.Float32BufferAttribute(coverFoil, 3));
  book.add(new THREE.LineSegments(foilGeometry, new THREE.LineBasicMaterial({ color: palette.edge })));

  // 하드커버 밖으로 살짝 내려오는 천 책갈피.
  const bookmark = new THREE.BufferGeometry();
  bookmark.setAttribute("position", new THREE.Float32BufferAttribute([
    0.5, 0.19, 1.85, 0.78, 0.19, 1.85, 0.78, 0.18, 2.25,
    0.5, 0.18, 2.25, 0.78, 0.02, 2.65, 0.64, 0.08, 2.55, 0.5, 0.02, 2.65,
  ], 3));
  bookmark.setIndex([0, 3, 1, 1, 3, 2, 3, 5, 2, 2, 5, 4, 3, 6, 5]);
  bookmark.computeVertexNormals();
  mesh(book, bookmark, rose, 0, 0, 0);

  const paperLines: number[] = [];
  for (const side of [-1, 1]) {
    for (let layer = 1; layer <= 12; layer++) {
      const fraction = layer / 13;
      const lineY = (x: number) => 0.2 + (pageHeight(x) - 0.2) * fraction;
      for (const z of [-2.078, 2.078]) {
        for (let step = 0; step < 40; step++) {
          const x1 = 0.055 + 3.12 * step / 40;
          const x2 = 0.055 + 3.12 * (step + 1) / 40;
          paperLines.push(side * x1, lineY(x1), z, side * x2, lineY(x2), z);
        }
      }
      paperLines.push(side * 3.178, lineY(3.175), -2.075, side * 3.178, lineY(3.175), 2.075);
    }
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(paperLines, 3));
  book.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: palette.edge, transparent: true, opacity: 0.75 })));

  function ribbon(points: THREE.Vector3[], width: number, surface: THREE.Material) {
    const curve = new THREE.CatmullRomCurve3(points);
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= 64; i++) {
      const p = curve.getPoint(i / 64);
      const tangent = curve.getTangent(i / 64);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(width / 2);
      for (const side of [-1, 1]) {
        const x = p.x + normal.x * side;
        vertices.push(x, pageHeight(x) + 0.025, p.z + normal.z * side);
      }
      if (i < 64) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const surfaceMaterial = surface.clone();
    surfaceMaterial.side = THREE.DoubleSide;
    mesh(book, geometry, surfaceMaterial, 0, 0, 0);
  }

  // 땅도 종이의 곡률을 따라가므로 책 위에 떠 있거나 중앙 접힘을 덮지 않는다.
  for (const [cx, cz, rx, rz] of [
    [-2.48, -1.02, 0.48, 0.75], [-2.2, 1.25, 0.48, 0.38],
    [2.63, -0.65, 0.32, 0.9], [2.15, 1.3, 0.48, 0.4],
  ]) {
    const positions = [cx, pageHeight(cx) + 0.013, cz];
    const indices: number[] = [];
    for (let i = 0; i <= 32; i++) {
      const angle = i / 32 * Math.PI * 2;
      const ripple = 1 + Math.sin(angle * 5) * 0.07;
      const x = cx + Math.cos(angle) * rx * ripple;
      positions.push(x, pageHeight(x) + 0.013, cz + Math.sin(angle) * rz * ripple);
      if (i < 32) indices.push(0, i + 2, i + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const patch = mesh(book, geometry, meadow, 0, 0, 0);
    patch.castShadow = false;
  }

  ribbon([new THREE.Vector3(-0.65, 0, 2), new THREE.Vector3(0.15, 0, 1.05), new THREE.Vector3(-0.25, 0, 0), new THREE.Vector3(0.35, 0, -1.9)], 0.35, water);
  ribbon([new THREE.Vector3(-2.75, 0, 1.6), new THREE.Vector3(-1.5, 0, 0.9), new THREE.Vector3(-1.7, 0, -0.55)], 0.23, pathMaterial);
  ribbon([new THREE.Vector3(0.65, 0, 1.75), new THREE.Vector3(1.5, 0, 0.75), new THREE.Vector3(1.1, 0, 0), new THREE.Vector3(1.4, 0, -0.65)], 0.23, pathMaterial);

  function tree(x: number, z: number, size: number, light: boolean) {
    const group = new THREE.Group();
    group.position.set(x, pageHeight(x) + 0.025, z);
    group.scale.setScalar(size);
    book.add(group);
    ball(group, foliage, 0, 0.005, 0, 0.18, 0.025, 0.16);
    mesh(group, trunk, bark, 0, 0.3, 0);
    const leaves = light ? foliageLight : foliage;
    ball(group, leaves, 0, 0.76, 0, 0.28, 0.42, 0.28);
    ball(group, leaves, -0.17, 0.62, 0.02, 0.22, 0.27, 0.21);
    ball(group, leaves, 0.15, 0.67, 0.05, 0.2, 0.29, 0.22);
  }
  const trees = [
    [-2.65, -1.5, 0.82], [-2.65, 0.05, 0.7], [-2.8, 1.2, 0.48],
    [-0.78, -1.55, 0.6], [2.7, -1.5, 0.8], [2.7, 0.65, 0.7], [2.15, 1.5, 0.48],
  ];
  trees.forEach(([x, z, scale], index) => tree(x, z, scale, index % 3 === 0));

  function archedDoor(parent: THREE.Group, x: number, y: number, z: number, width: number, height: number, surface: THREE.Material) {
    const key = `${width},${height}`;
    let geometry = arches.get(key);
    if (!geometry) {
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2, 0);
      shape.lineTo(width / 2, 0);
      shape.lineTo(width / 2, height - width / 2);
      shape.absarc(0, height - width / 2, width / 2, 0, Math.PI, false);
      shape.closePath();
      geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false, curveSegments: 8 });
      arches.set(key, geometry);
    }
    return mesh(parent, geometry, surface, x, y, z);
  }

  const cottage = new THREE.Group();
  cottage.position.set(-1.7, pageHeight(-1.7), -1.05);
  cottage.rotation.y = 0.18;
  cottage.scale.setScalar(0.8);
  book.add(cottage);
  const cottageRoofMaterial = material(color(palette.cover, palette.leaf, 0.2));
  const plaster = material(color(palette.paper, palette.rose, 0.16));
  const timber = material(color(palette.edge, palette.coverDark, 0.44));

  function gableRoof(parent: THREE.Group, width: number, height: number, depth: number, x: number, y: number, z: number) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, height);
    shape.closePath();
    const roof = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }),
      [plaster, cottageRoofMaterial],
    );
    roof.position.set(x, y, z - depth / 2);
    roof.castShadow = true;
    roof.receiveShadow = true;
    parent.add(roof);
    // 박공 테두리만 남겨 작은 화면에서도 지붕의 실루엣이 읽히게 한다.
    for (const side of [-1, 1]) {
      const beam = box(parent, Math.hypot(width / 2, height), 0.045, 0.045, timber, x + side * width / 4, y + height / 2, z + depth / 2 + 0.014, 0.008);
      beam.rotation.z = -side * Math.atan2(height, width / 2);
    }
  }

  box(cottage, 1.32, 0.1, 1.23, edge, 0, 0.035, 0.07, 0.055);
  box(cottage, 1.18, 0.98, 1.05, plaster, 0, 0.56, -0.05, 0.035);
  gableRoof(cottage, 1.55, 0.87, 1.27, 0, 1.055, -0.05);
  for (const y of [0.13, 1.02]) box(cottage, 1.25, 0.045, 1.1, timber, 0, y, -0.05, 0.01);
  for (const x of [-0.555, 0.555]) box(cottage, 0.045, 0.94, 0.05, timber, x, 0.57, 0.48, 0.008);

  function cottageWindow(parent: THREE.Group, x: number, y: number, z: number, rotation = 0, scale = 1) {
    const window = new THREE.Group();
    window.position.set(x, y, z);
    window.rotation.y = rotation;
    window.scale.setScalar(scale);
    parent.add(window);
    box(window, 0.25, 0.31, 0.04, timber, 0, 0, 0, 0.015);
    box(window, 0.195, 0.25, 0.025, windowLight, 0, 0, 0.032, 0.008);
    box(window, 0.017, 0.26, 0.02, paper, 0, 0, 0.053, 0.004);
    box(window, 0.2, 0.017, 0.02, paper, 0, 0, 0.053, 0.004);
    for (const side of [-1, 1]) box(window, 0.065, 0.3, 0.035, cottageRoofMaterial, side * 0.164, 0, 0.008, 0.012);
    box(window, 0.33, 0.07, 0.15, timber, 0, -0.2, 0.055, 0.015);
    for (const dx of [-0.09, 0, 0.09]) {
      ball(window, foliage, dx, -0.16, 0.075, 0.065, 0.035, 0.055);
      ball(window, dx === 0 ? gold : rose, dx, -0.12, 0.085, 0.036);
    }
  }
  cottageWindow(cottage, -0.38, 0.64, 0.49, 0, 0.8);
  cottageWindow(cottage, 0.38, 0.64, 0.49, 0, 0.8);
  cottageWindow(cottage, 0.61, 0.6, -0.15, Math.PI / 2);

  // 둥근 다락창은 숲속 집의 작은 표정으로 남긴다.
  const roundFrame = column(cottage, timber, 0, 1.46, 0.595, 0.16, 0.035);
  roundFrame.rotation.x = Math.PI / 2;
  const roundWindow = column(cottage, windowLight, 0, 1.46, 0.621, 0.122, 0.02);
  roundWindow.rotation.x = Math.PI / 2;
  box(cottage, 0.016, 0.245, 0.02, paper, 0, 1.46, 0.635, 0.004);
  box(cottage, 0.245, 0.016, 0.02, paper, 0, 1.46, 0.635, 0.004);

  archedDoor(cottage, 0, 0.095, 0.49, 0.33, 0.61, timber);
  archedDoor(cottage, 0, 0.11, 0.52, 0.245, 0.51, coverDark);
  ball(cottage, gold, 0.072, 0.33, 0.56, 0.02);
  gableRoof(cottage, 0.72, 0.28, 0.59, 0, 0.78, 0.6);
  for (const x of [-0.3, 0.3]) {
    column(cottage, timber, x, 0.43, 0.83, 0.025, 0.7);
    column(cottage, edge, x, 0.11, 0.83, 0.04, 0.08);
  }
  for (let i = 0; i < 3; i++) box(cottage, 0.66 + i * 0.07, 0.05, 0.17, edge, 0, 0.13 - i * 0.035, 0.78 + i * 0.12, 0.012);
  box(cottage, 0.025, 0.14, 0.1, gold, -0.21, 0.69, 0.6, 0.006);
  ball(cottage, windowLight, -0.21, 0.61, 0.64, 0.047, 0.063, 0.047);

  box(cottage, 0.17, 0.58, 0.19, edge, -0.37, 1.79, -0.31, 0.018);
  box(cottage, 0.23, 0.065, 0.25, timber, -0.37, 2.08, -0.31, 0.015);
  ball(cottage, paper, -0.36, 2.25, -0.32, 0.075, 0.1, 0.075);

  const castle = new THREE.Group();
  castle.position.set(1.4, 0.73, -0.95);
  book.add(castle);
  // 성문 위치는 진입 카메라와 공유하므로 유지하고, 뒤쪽으로 높이를 쌓는다.
  box(castle, 1.85, 0.12, 1.35, edge, 0, 0.03, -0.08, 0.06);
  box(castle, 1.28, 0.83, 0.72, paper, 0, 0.46, 0, 0.035);
  box(castle, 0.72, 1.48, 0.63, paper, 0.04, 0.8, -0.19, 0.025);
  for (const y of [0.16, 0.85]) box(castle, 1.34, 0.065, 0.78, edge, 0, y, 0, 0.015);
  box(castle, 0.8, 0.065, 0.71, gold, 0.04, 1.51, -0.19, 0.012);
  const keepRoof = mesh(castle, new THREE.ConeGeometry(0.61, 0.68, 4), roof, 0.04, 1.88, -0.19);
  keepRoof.rotation.y = Math.PI / 4;
  keepRoof.scale.z = 0.92;

  archedDoor(castle, 0, 0.065, 0.365, 0.52, 0.65, edge);
  archedDoor(castle, 0, 0.08, 0.395, 0.38, 0.55, coverDark);
  for (const x of [-0.135, -0.09, -0.045, 0, 0.045, 0.09, 0.135]) {
    box(castle, 0.008, 0.36, 0.012, cover, x, 0.28, 0.424, 0.002);
  }
  for (const x of [-0.055, 0.055]) ball(castle, gold, x, 0.29, 0.438, 0.017);
  for (let i = 0; i < 3; i++) {
    box(castle, 0.66 + i * 0.16, 0.045, 0.13, edge, 0, 0.06 - i * 0.03, 0.49 + i * 0.12, 0.008);
  }
  for (const x of [-0.54, -0.36, 0.36, 0.54]) {
    box(castle, 0.11, 0.16, 0.15, paper, x, 0.96, 0.28, 0.012);
    box(castle, 0.13, 0.025, 0.17, gold, x, 1.045, 0.28, 0.004);
  }

  const spire = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(1.32, 0),
    new THREE.Vector2(1.32, 0.035), new THREE.Vector2(1.03, 0.1),
    new THREE.Vector2(0.7, 0.32), new THREE.Vector2(0.32, 0.65),
    new THREE.Vector2(0.1, 0.92), new THREE.Vector2(0, 1),
  ], 20);
  const roofRing = new THREE.TorusGeometry(1, 0.018, 4, 20);
  function tower(x: number, z: number, height: number, radius: number) {
    column(castle, paper, x, height / 2 + 0.08, z, radius, height);
    for (const y of [0.14, height + 0.04]) {
      column(castle, edge, x, y, z, radius * 1.12, 0.055);
    }
    column(castle, gold, x, height + 0.095, z, radius * 1.18, 0.022);
    const top = mesh(castle, spire, roof, x, height + 0.11, z);
    const roofHeight = radius * 3.4;
    top.scale.set(radius, roofHeight, radius);
    const ring = mesh(castle, roofRing, edge, x, height + 0.11 + roofHeight * 0.1, z);
    ring.rotation.x = Math.PI / 2;
    ring.scale.setScalar(radius * 1.03);
    ring.castShadow = false;
    const tip = height + roofHeight + 0.11;
    column(castle, gold, x, tip + 0.045, z, 0.012, 0.12);
    ball(castle, gold, x, tip + 0.1, z, 0.025);
    for (const side of [0, Math.PI / 2]) {
      const window = new THREE.Group();
      window.position.set(x, height * 0.65, z);
      window.rotation.y = side;
      castle.add(window);
      archedDoor(window, 0, 0, radius, 0.13, 0.26, edge);
      archedDoor(window, 0, 0.025, radius + 0.025, 0.086, 0.205, coverDark);
      archedDoor(window, 0, 0.04, radius + 0.051, 0.055, 0.165, windowLight);
    }
    return tip;
  }
  tower(-0.68, 0.28, 1.14, 0.19);
  tower(0.68, 0.28, 1.3, 0.19);
  const highestTip = tower(0.08, -0.4, 1.82, 0.2);

  // 문 위 시계와 양옆의 길쭉한 창: 작은 화면에서도 궁전의 정면이 읽힌다.
  const clockFrame = column(castle, gold, 0.04, 1.26, 0.14, 0.145, 0.035);
  clockFrame.rotation.x = Math.PI / 2;
  const clockFace = column(castle, paper, 0.04, 1.26, 0.165, 0.116, 0.02);
  clockFace.rotation.x = Math.PI / 2;
  box(castle, 0.014, 0.09, 0.014, coverDark, 0.04, 1.29, 0.181, 0.003);
  box(castle, 0.07, 0.014, 0.014, coverDark, 0.068, 1.26, 0.181, 0.003);
  for (const x of [-0.22, 0.3]) {
    archedDoor(castle, x, 1.02, 0.145, 0.1, 0.27, cover);
    archedDoor(castle, x, 1.04, 0.173, 0.055, 0.21, windowLight);
  }

  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0);
  flagShape.bezierCurveTo(0.1, 0.05, 0.22, -0.08, 0.33, -0.01);
  flagShape.lineTo(0.27, -0.095);
  flagShape.lineTo(0.33, -0.18);
  flagShape.bezierCurveTo(0.21, -0.24, 0.1, -0.11, 0, -0.15);
  flagShape.closePath();
  const flagGeometry = new THREE.ExtrudeGeometry(flagShape, { depth: 0.012, bevelEnabled: false, curveSegments: 6 });
  const pole = column(castle, gold, 0.08, highestTip + 0.15, -0.4, 0.012, 0.3);
  pole.castShadow = false;
  const flag = mesh(castle, flagGeometry, gold, 0.092, highestTip + 0.29, -0.4);
  flag.scale.setScalar(0.7);
  flag.rotation.y = -0.2;

  const bridge = new THREE.Group();
  bridge.position.set(0.02, 0.57, 1.08);
  bridge.rotation.y = -0.3;
  book.add(bridge);
  for (let i = 0; i < 9; i++) {
    const x = -0.4 + i * 0.1;
    box(bridge, 0.105, 0.055, 0.35, edge, x, 0.15 * Math.sin(Math.PI * i / 8), 0, 0.015);
  }
  for (const z of [-0.19, 0.19]) {
    const points = Array.from({ length: 17 }, (_, i) => new THREE.Vector3(-0.4 + i * 0.05, 0.15 * Math.sin(Math.PI * i / 16) + 0.15, z));
    mesh(bridge, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.022, 6, false), edge, 0, 0, 0);
    for (const x of [-0.37, 0, 0.37]) box(bridge, 0.03, 0.16, 0.03, edge, x, x === 0 ? 0.23 : 0.09, z, 0.008);
  }

  // 반복 꽃잎은 한 번에 그려 가까운 시점의 디테일을 늘려도 draw call을 제한한다.
  const flowerCount = 12;
  const petals = new THREE.InstancedMesh(detailSphere, paper, flowerCount * 5);
  const centers = new THREE.InstancedMesh(detailSphere, gold, flowerCount);
  const instance = new THREE.Object3D();
  for (let i = 0; i < flowerCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const x = side * (0.8 + (i * 0.37 % 2.1));
    const z = 1.4 - (i * 0.43 % 3.1);
    const y = pageHeight(x) + 0.045;
    instance.position.set(x, y + 0.01, z);
    instance.scale.set(0.027, 0.023, 0.027);
    instance.updateMatrix();
    centers.setMatrixAt(i, instance.matrix);
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal * Math.PI * 2 / 5;
      instance.position.set(x + Math.cos(angle) * 0.045, y, z + Math.sin(angle) * 0.045);
      instance.scale.set(0.037, 0.021, 0.037);
      instance.updateMatrix();
      petals.setMatrixAt(i * 5 + petal, instance.matrix);
    }
  }
  petals.receiveShadow = true;
  centers.receiveShadow = true;
  book.add(petals, centers);

  for (const [x, z, size] of [[-2.75, 0.6, 0.8], [2.65, 1.18, 0.65]]) {
    const y = pageHeight(x);
    column(book, paper, x, y + 0.075 * size, z, 0.035 * size, 0.15 * size);
    ball(book, rose, x, y + 0.16 * size, z, 0.12 * size, 0.06 * size, 0.12 * size);
    for (const dx of [-0.045, 0.035]) ball(book, paper, x + dx * size, y + 0.215 * size, z, 0.018 * size, 0.008 * size, 0.018 * size);
  }
  for (const [x, z] of [[-2.05, -1.63], [2.85, 0.28]]) {
    const y = pageHeight(x);
    ball(book, foliage, x, y + 0.09, z, 0.24, 0.16, 0.19);
    ball(book, foliageLight, x + 0.15, y + 0.07, z + 0.05, 0.17, 0.12, 0.16);
    ball(book, rose, x - 0.08, y + 0.22, z, 0.035);
  }

  function cloud(x: number, y: number, z: number, scale: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    book.add(group);
    ball(group, paper, 0, 0, 0, 0.42, 0.2, 0.18);
    ball(group, paper, -0.17, 0.1, 0, 0.19, 0.22, 0.17);
    ball(group, paper, 0.1, 0.17, 0, 0.23, 0.27, 0.18);
  }
  cloud(-2.6, 2.05, -1.85, 0.6);
  cloud(2.65, 2.45, -1.85, 0.5);

  // 구체뿐 아니라 반복 성벽·첨탑·창문도 묶는다. 정적 모델의 변환과 shadow 속성을 보존한다.
  book.updateMatrixWorld(true);
  const batches = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]>();
  book.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) return;
    const key = `${object.geometry.uuid}:${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    const objects = batches.get(key) ?? [];
    objects.push(object);
    batches.set(key, objects);
  });
  batches.forEach((objects) => {
    if (objects.length < 2) return;
    const first = objects[0];
    const instances = new THREE.InstancedMesh(first.geometry, first.material, objects.length);
    objects.forEach((object, index) => {
      instances.setMatrixAt(index, object.matrixWorld);
      object.removeFromParent();
    });
    instances.castShadow = first.castShadow;
    instances.receiveShadow = first.receiveShadow;
    book.add(instances);
  });
  return book;
}
