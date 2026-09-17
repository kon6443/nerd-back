import * as THREE from "three";
import type { BookPalette } from "@/app/book-model";

/** 책 속 작은 빛가루. 기존 render의 진행값만 받아 움직이며 자원 해제는 BookWorld가 담당한다. */
export function createBookAtmosphere(palette: BookPalette) {
  const group = new THREE.Group();
  const blend = (a: string, b: string, amount: number) => new THREE.Color(a).lerp(new THREE.Color(b), amount);
  const instance = new THREE.Object3D();

  const sparkleShape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const radius = i % 2 === 0 ? 1 : 0.22;
    if (i === 0) sparkleShape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else sparkleShape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  sparkleShape.closePath();
  const sparkleMaterial = new THREE.MeshBasicMaterial({ color: blend(palette.gold, palette.edge, 0.5), transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide });
  const stars = new THREE.InstancedMesh(new THREE.ShapeGeometry(sparkleShape), sparkleMaterial, 3);
  const dust = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), sparkleMaterial, 8);
  stars.name = "entry-stars";
  dust.name = "entry-dust";
  const particles = [stars, dust].flatMap((mesh, meshIndex) => {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // 이동 범위가 작고 입자가 11개뿐이므로 매 프레임 bounding sphere를 재계산하지 않는다.
    mesh.frustumCulled = false;
    group.add(mesh);
    return Array.from({ length: mesh.count }, (_, index) => {
      const angle = (index + meshIndex * 0.6) * 2.39996;
      return {
        mesh, index, angle,
        origin: new THREE.Vector3(1.4 + Math.cos(angle) * 1.25, 1.1 + (index % 4) * 0.3, -0.55 + Math.sin(angle) * 1.3),
        size: meshIndex === 0 ? 0.04 + index % 3 * 0.008 : 0.012 + index % 3 * 0.004,
      };
    });
  });
  const doorway = new THREE.Vector3(1.4, 1.1, -0.53);
  let previousEntry = Number.NaN;
  function update(entry: number) {
    const progress = Number.isFinite(entry) ? THREE.MathUtils.clamp(entry, 0, 1) : 0;
    if (progress === previousEntry) return;
    previousEntry = progress;
    particles.forEach(({ mesh, index, angle, origin, size }) => {
      const t = THREE.MathUtils.clamp((progress - index % 5 * 0.015) / 0.84, 0, 1);
      const eased = t * t * (3 - 2 * t);
      instance.position.lerpVectors(origin, doorway, eased);
      instance.position.y += Math.sin(t * Math.PI) * 0.22;
      instance.position.x += Math.sin(t * Math.PI) * Math.sin(angle) * 0.16;
      instance.rotation.set(-0.25, 0.65 + t * 0.4, angle + t * Math.PI);
      instance.scale.setScalar(size * (1 - eased * 0.82));
      instance.updateMatrix();
      mesh.setMatrixAt(index, instance.matrix);
    });
    sparkleMaterial.opacity = 0.65 * (1 - THREE.MathUtils.smoothstep(progress, 0.72, 0.96));
    stars.visible = dust.visible = progress < 0.96;
    stars.instanceMatrix.needsUpdate = true;
    dust.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { group, update };
}
