import * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";
import { createBookAtmosphere } from "@/app/book-atmosphere";

const palette = {
  paper: "#fbf7ec", edge: "#d3b68a", cover: "#2f5b69", coverDark: "#22454f",
  leaf: "#d7feb9", gold: "#ffc800", sky: "#1cb0f6", rose: "#ffdfe0",
};
const created: THREE.Group[] = [];
function setup() {
  const atmosphere = createBookAtmosphere(palette);
  created.push(atmosphere.group);
  const particles = atmosphere.group.children.filter(
    (object): object is THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> =>
      object instanceof THREE.InstancedMesh && object.instanceMatrix.usage === THREE.DynamicDrawUsage,
  );
  return { ...atmosphere, particles };
}

afterEach(() => {
  for (const group of created.splice(0)) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.InstancedMesh) object.dispose();
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    group.clear();
  }
});

describe("book atmosphere", () => {
  it("별과 빛가루가 성문으로 모인 후 진입 시야에서 사라진다", () => {
    const { update, particles } = setup();
    const doorway = new THREE.Vector3(1.4, 1.1, -0.53);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const meanDistance = () => {
      let distance = 0;
      let count = 0;
      for (const mesh of particles) {
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix);
          distance += position.setFromMatrixPosition(matrix).distanceTo(doorway);
          count++;
        }
      }
      expect(count).toBeGreaterThan(0);
      return distance / count;
    };
    const initial = meanDistance();
    update(0.65);
    expect(meanDistance()).toBeLessThan(initial * 0.4);
    update(1);
    expect(meanDistance()).toBeLessThan(0.00001);
    particles.forEach(mesh => {
      expect(mesh.visible).toBe(false);
      expect(mesh.material.opacity).toBe(0);
    });
  });

  it("진입 취소와 재진입은 누적 오차 없이 원래 배치를 복원한다", () => {
    const { update, particles } = setup();
    const initial = particles.map(mesh => [...mesh.instanceMatrix.array]);
    for (const entry of [0.2, 0.65, 1]) {
      update(entry);
      update(0);
      particles.forEach((mesh, index) => {
        expect([...mesh.instanceMatrix.array]).toEqual(initial[index]);
        expect(mesh.visible).toBe(true);
        expect(mesh.material.opacity).toBeGreaterThan(0);
      });
    }
  });

  it("같은 progress로 재렌더할 때 입자 buffer를 다시 갱신하지 않는다", () => {
    const { update, particles } = setup();
    update(0.3);
    const versions = particles.map(mesh => mesh.instanceMatrix.version);
    update(0.3);
    expect(particles.map(mesh => mesh.instanceMatrix.version)).toEqual(versions);
    update(0.4);
    particles.forEach((mesh, index) => expect(mesh.instanceMatrix.version).toBe(versions[index] + 1));
  });

  it("경계 밖 값과 비정상 값은 안전한 시작·끝 상태로 제한한다", () => {
    const { update, particles } = setup();
    const initial = particles.map(mesh => [...mesh.instanceMatrix.array]);
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      update(0.5);
      update(value);
      particles.forEach((mesh, index) => expect([...mesh.instanceMatrix.array]).toEqual(initial[index]));
    }
    update(2);
    particles.forEach(mesh => {
      expect([...mesh.instanceMatrix.array].every(Number.isFinite)).toBe(true);
      expect(mesh.visible).toBe(false);
    });
  });
});
