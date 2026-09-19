import * as THREE from "three";
import { cloudOffset, type JourneyPose } from "./journeyTimeline";

import { createSculpture } from "./journeySculpture";

export function createJourneyScenery() {
  const group = new THREE.Group();
  const kingdom = new THREE.Group();
  group.add(kingdom);
  const sculpture = createSculpture();
  const { add } = sculpture;
  add(kingdom, "sphere", "#a6cc8e", [0, -2.6, -28], [34, 3, 53]);
  add(kingdom, "sphere", "#cee0a2", [0, -0.8, 0], [4.5, 0.8, 3.8]);
  // A warm winding ribbon, built once from overlapping low-profile shapes.
  for (let i = 0; i < 24; i++) {
    const z = -i * 2.7;
    add(kingdom, "sphere", "#f0ddad", [Math.sin(i * 0.3) * 1.4, -0.04, z], [1.4, 0.09, 1.8]);
  }
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 19; i++) {
      const z = 3 - i * 4;
      const x = side * (4.2 + (i % 3) * 1.8);
      const size = 0.8 + (i % 4) * 0.14;
      if (!(side > 0 && i >= 9 && i <= 12)) {
        add(kingdom, "cylinder", "#947653", [x, 1.1 * size, z], [0.17, 2.2 * size, 0.17]);
        add(kingdom, "sphere", i % 2 ? "#77b58a" : "#9cc995", [x, 2.7 * size, z], [1.2 * size, 1.2 * size, 1.15 * size]);
        add(kingdom, "sphere", "#a9d197", [x - 0.65, 3.15 * size, z + 0.25], [0.8 * size, 0.9 * size, 0.85 * size]);
        add(kingdom, "sphere", "#92c797", [x + 0.6, 2.9 * size, z + 0.15], [0.8 * size, 0.85 * size, 0.8 * size]);
      }
      for (let j = 0; j < 3; j++) {
        const mx = side * (2.1 + j * 0.45);
        const mz = z + j * 0.7;
        add(kingdom, "cylinder", "#fff0d2", [mx, 0.22, mz], [0.055, 0.44, 0.055]);
        add(kingdom, "sphere", "#e57976", [mx, 0.47, mz], [0.24, 0.16, 0.24]);
        add(kingdom, "sphere", "#fff5e5", [mx + 0.09, 0.59, mz + 0.03], [0.045, 0.026, 0.045]);
        const fx = side * (2.6 + j * 0.42);
        add(kingdom, "cylinder", "#729566", [fx, 0.21, mz - 1], [0.018, 0.42, 0.018]);
        add(kingdom, "sphere", ["#f5c3bf", "#ecd587", "#c2b7e1"][j], [fx, 0.44, mz - 1], [0.12, 0.1, 0.12]);
        add(kingdom, "sphere", "#fff4cf", [fx, 0.53, mz - 1], [0.035, 0.03, 0.035]);
      }
    }
  }
  for (let i = 0; i < 12; i++) {
    add(kingdom, "sphere", i % 2 ? "#b2cfa2" : "#91be97", [(i % 2 ? -1 : 1) * (14 + i % 3 * 3), -1.8, -i * 6], [9, 4 + i % 3, 8]);
  }

  const castle = new THREE.Group();
  castle.position.set(2.6, 0.35, -46);
  castle.scale.setScalar(0.85);
  castle.rotation.y = -0.16;
  kingdom.add(castle);
  add(castle, "sphere", "#b4cd98", [0, -0.3, 0], [6.2, 1.1, 4.7]);
  add(castle, "box", "#f3c7cc", [0, 2.1, 0], [5.6, 4.2, 2.6]);
  add(castle, "box", "#ffe8d4", [0, 4.25, 0], [5.8, 0.25, 2.8]);
  for (let i = 0; i < 9; i++) add(castle, "box", "#ffe8d4", [-2.6 + i * 0.65, 4.55, 1.27], [0.35, 0.55, 0.35]);
  const tower = (x: number, y: number, z: number, width: number, height: number) => {
    add(castle, "cylinder", "#f8d7d6", [x, y + height / 2, z], [width, height, width]);
    add(castle, "cylinder", "#fff0da", [x, y + height - 0.12, z], [width * 1.13, 0.24, width * 1.13]);
    add(castle, "cone", "#af9bc8", [x, y + height + width * 1.4, z], [width * 1.3, width * 2.8, width * 1.3]);
    add(castle, "sphere", "#efd58e", [x, y + height + width * 2.85, z], [0.13, 0.2, 0.13]);
    add(castle, "box", "#776f9d", [x, y + height * 0.64, z + width * 0.98], [width * 0.4, width * 0.85, 0.045]);
    add(castle, "sphere", "#776f9d", [x, y + height * 0.64 + width * 0.42, z + width * 0.99], [width * 0.2, width * 0.22, 0.035]);
    add(castle, "box", "#f7dfa1", [x, y + height * 0.64, z + width * 1.02], [0.055, width * 0.95, 0.04]);
  };
  tower(-2.7, 0, 0.5, 0.73, 5.1);
  tower(2.7, 0, 0.5, 0.73, 5.1);
  tower(-1.6, 3.8, -0.5, 0.67, 2.8);
  tower(1.6, 3.8, -0.5, 0.67, 2.8);
  tower(0, 3.8, -0.75, 1.0, 4.1);
  add(castle, "box", "#a18092", [0, 1.1, 1.34], [1.3, 2.2, 0.1]);
  add(castle, "sphere", "#a18092", [0, 2.18, 1.36], [0.65, 0.6, 0.06]);
  add(castle, "box", "#f5ddb4", [0, 0.12, 2.4], [1.6, 0.2, 2]);
  const flag = new THREE.Group();
  flag.position.set(0, 10.8, -0.75);
  castle.add(flag);
  add(flag, "cylinder", "#d3b168", [0, 0.15, 0], [0.035, 1.1, 0.035]);
  add(flag, "box", "#e89baf", [0.38, 0.48, 0], [0.75, 0.36, 0.04], [0, 0, -0.07]);

  const lanterns = new THREE.Group();
  group.add(lanterns);
  const rotatingLanterns: THREE.Group[] = [];
  for (let i = 0; i < 10; i++) {
    const u = i / 9;
    const lantern = new THREE.Group();
    lantern.position.set(Math.sin(i * 2.2) * 3.3, 5.5 + u * 17, -54 - u * 28);
    lanterns.add(lantern);
    add(lantern, "gem", i % 2 ? "#bb9ddd" : "#f2d68e", [0, 0, 0], [0.34, 0.64, 0.34]);
    add(lantern, "ring", "#f8dfa0", [0, 0, 0], [0.68, 0.68, 0.68], [0.15, 0, 0]);
    rotatingLanterns.push(lantern);
  }
  for (let i = 0; i < 5; i++) {
    add(lanterns, "ring", "#f8dfa0", [0, 6.5 + i * 3.4, -56 - i * 5], [2.6, 2.6, 2.6], [-0.45, 0, i * 0.18]);
  }

  const sky = new THREE.Group();
  group.add(sky);
  // Recycle a fixed set of banks; nothing is allocated as the journey continues.
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 24; i++) {
    const cloud = new THREE.Group();
    sky.add(cloud);
    cloud.position.set((i % 6 - 2.5) * 9, 15 + i % 3 * 1.15, -82 - Math.floor(i / 6) * 22);
    for (let j = 0; j < 7; j++) {
      const angle = j * 2.4;
      add(cloud, "sphere", "#ffffff", [Math.cos(angle) * 2.1, j > 3 ? 1.3 : 0, Math.sin(angle) * 1.5], [2.25, 1.8 + j % 3 * 0.4, 2.2]);
    }
    clouds.push(cloud);
  }
  const balloon = new THREE.Group();
  sky.add(balloon);
  add(balloon, "sphere", "#f3c3ad", [0, 0, 0], [1.05, 1.6, 1.05]);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    add(balloon, "sphere", i % 2 ? "#ebadb5" : "#f5dfb4", [Math.sin(angle) * 0.69, 0, Math.cos(angle) * 0.69], [0.52, 1.6, 0.52]);
  }
  add(balloon, "box", "#b99374", [0, -2.4, 0], [0.75, 0.5, 0.7]);
  for (const x of [-0.3, 0.3]) add(balloon, "cylinder", "#d1b58e", [x, -1.85, 0.25], [0.025, 0.8, 0.025]);
  sculpture.finish();
  kingdom.traverse(object => {
    if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
  });

  return {
    group,
    update(time: number, pose: JourneyPose) {
      kingdom.visible = time < 19;
      lanterns.visible = time > 8 && time < 22;
      sky.visible = time > 10;
      flag.rotation.y = Math.sin(time * 1.5) * 0.16;
      rotatingLanterns.forEach((lantern, i) => { lantern.rotation.y = time * 0.45 + i; });
      const travel = Math.max(0, -pose.hero[2] - 82);
      clouds.forEach((cloud, i) => {
        cloud.position.z = pose.hero[2] + cloudOffset(travel, Math.floor(i / 6));
      });
      balloon.position.set(10 + Math.sin(time * 0.2), 28 + Math.sin(time * 0.45) * 0.45, pose.hero[2] - 34);
      balloon.rotation.z = Math.sin(time * 0.35) * 0.05;
    },
  };
}
