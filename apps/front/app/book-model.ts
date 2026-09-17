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
  const foliage = material(color(palette.leaf, palette.cover, 0.5));
  const foliageLight = material(color(palette.leaf, palette.paper, 0.5));
  const bark = material(color(palette.edge, palette.coverDark, 0.36));
  const roof = material(color(palette.rose, palette.edge, 0.35));
  const gold = material(palette.gold);
  const water = material(color(palette.sky, palette.paper, 0.65));
  const pathMaterial = material(color(palette.edge, palette.gold, 0.12));
  const sphere = new THREE.SphereGeometry(1, 16, 12);

  function mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, surface: THREE.Material, x: number, y: number, z: number) {
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function box(parent: THREE.Group, width: number, height: number, depth: number, surface: THREE.Material, x: number, y: number, z: number, radius = 0.05) {
    return mesh(parent, new RoundedBoxGeometry(width, height, depth, 2, radius), surface, x, y, z);
  }

  function ball(parent: THREE.Group, surface: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) {
    const object = mesh(parent, sphere, surface, x, y, z);
    object.scale.set(sx, sy, sz);
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

  ribbon([new THREE.Vector3(-0.65, 0, 2), new THREE.Vector3(0.15, 0, 1.05), new THREE.Vector3(-0.25, 0, 0), new THREE.Vector3(0.35, 0, -1.9)], 0.3, water);
  ribbon([new THREE.Vector3(-2.75, 0, 1.6), new THREE.Vector3(-1.5, 0, 0.9), new THREE.Vector3(-1.7, 0, -0.55)], 0.23, pathMaterial);
  ribbon([new THREE.Vector3(0.65, 0, 1.75), new THREE.Vector3(1.5, 0, 0.75), new THREE.Vector3(1.1, 0, 0), new THREE.Vector3(1.4, 0, -0.65)], 0.23, pathMaterial);

  function tree(x: number, z: number, size: number, light: boolean) {
    const group = new THREE.Group();
    group.position.set(x, pageHeight(x) + 0.025, z);
    group.scale.setScalar(size);
    book.add(group);
    ball(group, foliage, 0, 0.005, 0, 0.18, 0.025, 0.16);
    mesh(group, new THREE.CylinderGeometry(0.04, 0.065, 0.6, 8), bark, 0, 0.3, 0);
    const leaves = light ? foliageLight : foliage;
    ball(group, leaves, 0, 0.76, 0, 0.28, 0.42, 0.28);
    ball(group, leaves, -0.17, 0.62, 0.02, 0.22, 0.27, 0.21);
    ball(group, leaves, 0.15, 0.67, 0.05, 0.2, 0.29, 0.22);
  }
  const trees = [
    [-2.7, -1.55, 1], [-2.65, 0.05, 0.82], [-2.1, 0.5, 0.72], [-2.8, 1.2, 0.6],
    [-0.75, -1.6, 0.85], [-1.0, -0.75, 0.66], [-0.85, 0.65, 0.7],
    [2.7, -1.55, 1.1], [2.65, -0.35, 0.85], [2.7, 0.8, 1], [2.15, 1.5, 0.65], [0.65, -1.75, 0.65],
  ];
  trees.forEach(([x, z, scale], index) => tree(x, z, scale, index % 3 === 0));

  function archedDoor(parent: THREE.Group, x: number, y: number, z: number, width: number, height: number, surface: THREE.Material) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, height - width / 2);
    shape.absarc(0, height - width / 2, width / 2, 0, Math.PI, false);
    shape.closePath();
    mesh(parent, new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false, curveSegments: 12 }), surface, x, y, z);
  }

  const cottage = new THREE.Group();
  cottage.position.set(-1.7, pageHeight(-1.7), -0.95);
  cottage.rotation.y = 0.18;
  book.add(cottage);
  box(cottage, 0.92, 0.64, 0.78, edge, 0, 0.32, 0, 0.08);
  const cottageRoof = mesh(cottage, new THREE.ConeGeometry(0.82, 0.5, 4), cover, 0, 0.86, 0);
  cottageRoof.rotation.y = Math.PI / 4;
  cottageRoof.scale.z = 0.86;
  archedDoor(cottage, 0, 0.01, 0.394, 0.24, 0.4, coverDark);
  for (const x of [-0.3, 0.3]) {
    box(cottage, 0.18, 0.2, 0.035, paper, x, 0.35, 0.405, 0.02);
    box(cottage, 0.125, 0.14, 0.015, cover, x, 0.35, 0.427, 0.012);
    box(cottage, 0.016, 0.15, 0.02, paper, x, 0.35, 0.438, 0.004);
    box(cottage, 0.14, 0.016, 0.02, paper, x, 0.35, 0.438, 0.004);
    box(cottage, 0.21, 0.045, 0.08, edge, x, 0.23, 0.43, 0.01);
  }
  ball(cottage, gold, 0.065, 0.19, 0.435, 0.019);
  const roofSeams: number[] = [];
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const y = 1.11 - 0.5 * t;
    const half = 0.58 * t;
    roofSeams.push(-half, y + 0.006, half * 0.86 + 0.004, half, y + 0.006, half * 0.86 + 0.004);
  }
  const roofLines = new THREE.BufferGeometry();
  roofLines.setAttribute("position", new THREE.Float32BufferAttribute(roofSeams, 3));
  cottage.add(new THREE.LineSegments(roofLines, new THREE.LineBasicMaterial({ color: palette.coverDark, transparent: true, opacity: 0.35 })));
  box(cottage, 0.12, 0.29, 0.12, edge, 0.22, 1, -0.12, 0.02);

  const castle = new THREE.Group();
  castle.position.set(1.4, 0.73, -0.95);
  book.add(castle);
  box(castle, 1.3, 0.12, 1.02, edge, 0, 0.03, 0, 0.06);
  box(castle, 0.93, 0.73, 0.7, paper, 0, 0.42, 0, 0.05);
  archedDoor(castle, 0, 0.07, 0.36, 0.37, 0.5, edge);
  archedDoor(castle, 0, 0.085, 0.392, 0.27, 0.41, coverDark);
  for (const x of [-0.09, -0.03, 0.03, 0.09]) box(castle, 0.008, 0.25, 0.012, cover, x, 0.22, 0.42, 0.002);
  ball(castle, gold, 0.075, 0.26, 0.43, 0.018);
  for (const y of [0.15, 0.72]) box(castle, 1.01, 0.07, 0.76, edge, 0, y, 0, 0.025);
  for (const x of [-0.35, -0.175, 0, 0.175, 0.35]) {
    box(castle, 0.12, 0.12, 0.15, paper, x, 0.82, 0.27, 0.02);
  }

  function tower(x: number, z: number, height: number, radius: number) {
    mesh(castle, new THREE.CylinderGeometry(radius, radius * 1.08, height, 20), paper, x, height / 2 + 0.08, z);
    mesh(castle, new THREE.CylinderGeometry(radius * 1.16, radius * 1.16, 0.075, 20), edge, x, height + 0.05, z);
    const roofProfile = [
      new THREE.Vector2(0, radius * 2.4), new THREE.Vector2(radius * 0.13, radius * 1.95),
      new THREE.Vector2(radius * 0.52, radius * 1.12), new THREE.Vector2(radius * 1.1, radius * 0.27),
      new THREE.Vector2(radius * 1.5, 0.04), new THREE.Vector2(radius * 1.5, 0),
      new THREE.Vector2(0, 0),
    ];
    mesh(castle, new THREE.LatheGeometry(roofProfile.reverse(), 24), roof, x, height + 0.09, z);
    mesh(castle, new THREE.CylinderGeometry(radius * 1.07, radius * 1.07, 0.05, 20), edge, x, height * 0.4, z);
    ball(castle, gold, x, height + radius * 2.4 + 0.1, z, 0.035);
    archedDoor(castle, x, height * 0.61, z + radius + 0.002, radius * 0.72, radius * 1.14, edge);
    archedDoor(castle, x, height * 0.63, z + radius + 0.03, radius * 0.48, radius * 0.9, cover);
  }
  tower(-0.5, 0.25, 0.94, 0.17);
  tower(0.5, 0.25, 1.08, 0.17);
  tower(-0.4, -0.27, 1.25, 0.19);
  tower(0.32, -0.27, 1.65, 0.23);
  const flagPole = mesh(castle, new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), gold, 0.32, 2.47, -0.27);
  flagPole.castShadow = false;
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0); flagShape.lineTo(0.29, -0.025); flagShape.lineTo(0.23, -0.16); flagShape.lineTo(0, -0.13); flagShape.closePath();
  const flag = mesh(castle, new THREE.ExtrudeGeometry(flagShape, { depth: 0.018, bevelEnabled: false }), gold, 0.33, 2.65, -0.27);
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
  const petals = new THREE.InstancedMesh(sphere, paper, 60);
  const centers = new THREE.InstancedMesh(sphere, gold, 12);
  const instance = new THREE.Object3D();
  for (let i = 0; i < 12; i++) {
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

  function cloud(x: number, y: number, z: number, scale: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    book.add(group);
    ball(group, paper, 0, 0, 0, 0.42, 0.2, 0.18);
    ball(group, paper, -0.17, 0.1, 0, 0.19, 0.22, 0.17);
    ball(group, paper, 0.1, 0.17, 0, 0.23, 0.27, 0.18);
  }
  cloud(-2.9, 2.1, -1.8, 0.9);
  cloud(2.6, 2.75, -1.75, 0.8);
  cloud(0.2, 2.9, -2.15, 0.65);

  // 같은 구체를 쓰는 나무·구름·장식을 재질별로 묶고 원래 월드 변환을 보존한다.
  book.updateMatrixWorld(true);
  const sphereGroups = new Map<THREE.Material, THREE.Mesh[]>();
  book.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object.geometry !== sphere || Array.isArray(object.material)) return;
    const objects = sphereGroups.get(object.material) ?? [];
    objects.push(object);
    sphereGroups.set(object.material, objects);
  });
  sphereGroups.forEach((objects, surface) => {
    const instances = new THREE.InstancedMesh(sphere, surface, objects.length);
    objects.forEach((object, index) => {
      instances.setMatrixAt(index, object.matrixWorld);
      object.removeFromParent();
    });
    instances.castShadow = true;
    instances.receiveShadow = true;
    book.add(instances);
  });
  return book;
}
