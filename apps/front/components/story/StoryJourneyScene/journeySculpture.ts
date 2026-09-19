import * as THREE from "three";

/** One material and shared primitives, batched by shape and animated parent. */
export function createSculpture() {
  const geometries = {
    sphere: new THREE.SphereGeometry(1, 24, 16),
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
    cone: new THREE.ConeGeometry(1, 1, 24),
    ring: new THREE.TorusGeometry(1, 0.045, 8, 48),
    gem: new THREE.OctahedronGeometry(1),
  };
  const material = new THREE.MeshPhongMaterial({ color: "#ffffff", shininess: 24, specular: "#253039" });
  const batches = new Map<THREE.Group, Map<keyof typeof geometries, { matrix: THREE.Matrix4; color: THREE.Color }[]>>();
  const dummy = new THREE.Object3D();
  return {
    add(parent: THREE.Group, shape: keyof typeof geometries, color: string, position: [number, number, number], scale: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) {
      let group = batches.get(parent);
      if (!group) { group = new Map(); batches.set(parent, group); }
      let items = group.get(shape);
      if (!items) { items = []; group.set(shape, items); }
      dummy.position.set(...position);
      dummy.scale.set(...scale);
      dummy.rotation.set(...rotation);
      dummy.updateMatrix();
      items.push({ matrix: dummy.matrix.clone(), color: new THREE.Color(color) });
    },
    finish() {
      const used = new Set<keyof typeof geometries>();
      batches.forEach((group, parent) => group.forEach((items, shape) => {
        used.add(shape);
        const mesh = new THREE.InstancedMesh(geometries[shape], material, items.length);
        items.forEach((item, i) => { mesh.setMatrixAt(i, item.matrix); mesh.setColorAt(i, item.color); });
        mesh.computeBoundingSphere();
        parent.add(mesh);
      }));
      // Unused primitives never enter the scene traversal that owns disposal.
      for (const shape of Object.keys(geometries) as (keyof typeof geometries)[]) {
        if (!used.has(shape)) geometries[shape].dispose();
      }
      batches.clear();
    },
  };
}
