import * as THREE from "three";
import { createSculpture } from "./journeySculpture";
import { smooth, type JourneyPose } from "./journeyTimeline";

export function createJourneyCharacter() {
  const group = new THREE.Group();
  const bank = new THREE.Group();
  const rig = new THREE.Group();
  const body = new THREE.Group();
  group.add(bank);
  bank.add(rig);
  rig.position.y = 1.15;
  body.position.y = -1.15;
  rig.add(body);
  const sculpture = createSculpture();
  const { add } = sculpture;
  const skin = "#f2c6a5";
  add(body, "sphere", "#578cc6", [0, 1.08, 0], [0.43, 0.5, 0.29]);
  add(body, "sphere", "#719ed0", [0, 1.35, 0.05], [0.36, 0.26, 0.28]);
  add(body, "cylinder", skin, [0, 1.52, 0], [0.14, 0.26, 0.14]);
  add(body, "sphere", "#d4ae73", [0, 0.66, 0], [0.32, 0.22, 0.24]);
  add(body, "sphere", "#e56461", [0, 1.47, -0.025], [0.32, 0.09, 0.23]);
  add(body, "sphere", "#f2c57f", [0, 1.43, 0.29], [0.065, 0.065, 0.04]);
  const head = new THREE.Group();
  head.position.y = 1.98;
  body.add(head);
  add(head, "sphere", skin, [0, 0, 0], [0.56, 0.61, 0.48]);
  add(head, "sphere", skin, [-0.54, -0.04, 0], [0.11, 0.16, 0.1]);
  add(head, "sphere", skin, [0.54, -0.04, 0], [0.11, 0.16, 0.1]);
  add(head, "sphere", "#795440", [0, 0.13, -0.14], [0.59, 0.55, 0.48]);
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.155;
    add(head, "sphere", "#795440", [x, 0.01 + Math.abs(x) * 0.1, -0.44], [0.18, 0.23, 0.16]);
    add(head, "sphere", i % 2 ? "#896048" : "#795440", [x, 0.31 - Math.abs(x) * 0.18, 0.33], [0.19, 0.21 + i % 2 * 0.05, 0.17], [0, 0, -0.3 + i * 0.12]);
  }
  add(head, "sphere", "#795440", [-0.48, 0.01, 0.15], [0.12, 0.27, 0.19]);
  add(head, "sphere", "#795440", [0.48, 0.04, 0.13], [0.12, 0.26, 0.18]);
  add(head, "sphere", "#ed9f91", [-0.33, -0.17, 0.378], [0.115, 0.065, 0.035]);
  add(head, "sphere", "#ed9f91", [0.33, -0.17, 0.378], [0.115, 0.065, 0.035]);
  add(head, "sphere", "#edb695", [0, -0.12, 0.48], [0.08, 0.07, 0.07]);
  const eyes: THREE.Group[] = [];
  for (const x of [-0.205, 0.205]) {
    const eye = new THREE.Group();
    eye.position.set(x, -0.035, 0.444);
    head.add(eye);
    add(eye, "sphere", "#fff8ed", [0, 0, 0], [0.097, 0.124, 0.042]);
    add(eye, "sphere", "#5b4033", [0.012, 0.002, 0.039], [0.066, 0.09, 0.02]);
    add(eye, "sphere", "#2f2e32", [0.018, 0.002, 0.053], [0.034, 0.058, 0.012]);
    add(eye, "sphere", "#ffffff", [-0.006, 0.038, 0.065], [0.025, 0.028, 0.009]);
    eyes.push(eye);
    add(head, "sphere", "#795440", [x, 0.115, 0.43], [0.09, 0.025, 0.025], [0, 0, x]);
  }
  // A small curved smile, rather than a flat painted face.
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.025;
    add(head, "sphere", "#a5695f", [x, -0.27 + x * x * 7, 0.421], [0.022, 0.016, 0.016]);
  }
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.37, 1.35, 0);
    body.add(arm);
    add(arm, "sphere", "#578cc6", [side * 0.08, -0.2, 0], [0.16, 0.29, 0.16]);
    add(arm, "sphere", skin, [side * 0.12, -0.44, 0.03], [0.13, 0.15, 0.11]);
    if (side < 0) {
      // Two separated fingers make the raised selfie hand read as a V.
      add(arm, "sphere", skin, [side * 0.19, -0.61, 0.02], [0.04, 0.14, 0.04], [0, 0, -0.23]);
      add(arm, "sphere", skin, [side * 0.06, -0.61, 0.02], [0.04, 0.14, 0.04], [0, 0, 0.23]);
    }
    arms.push(arm);
  }
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.19, 0.61, 0);
    body.add(leg);
    add(leg, "sphere", "#d4ae73", [0, -0.21, 0], [0.145, 0.29, 0.15]);
    add(leg, "sphere", "#74584c", [0, -0.46, 0.07], [0.175, 0.14, 0.25]);
    add(leg, "sphere", "#f4e2bd", [0, -0.52, 0.085], [0.178, 0.06, 0.25]);
    legs.push(leg);
  }
  const capeGeometry = new THREE.PlaneGeometry(1, 1, 10, 12);
  const cape = new THREE.Mesh(capeGeometry, new THREE.MeshLambertMaterial({ color: "#dc625f", side: THREE.DoubleSide }));
  body.add(cape);
  const capePositions = capeGeometry.attributes.position;
  const capeOriginal = new Float32Array(capePositions.array);
  const board = new THREE.Group();
  group.add(board);
  for (let i = 0; i < 7; i++) add(board, "sphere", "#ffffff", [(i - 3) * 0.29, -0.16 + Math.sin(i * 2) * 0.05, i % 2 * 0.15], [0.5, 0.21 + i % 2 * 0.06, 0.42]);
  sculpture.finish();
  return {
    group,
    update(time: number, pose: JourneyPose, pointerX: number, pointerY: number) {
      group.position.set(...pose.hero);
      group.position.x += pointerX * pose.cruise * 1.5;
      group.position.y -= pointerY * pose.cruise * 0.35;
      group.rotation.y = pose.yaw;
      bank.rotation.z = pose.bank - pointerX * pose.cruise * 0.18;
      rig.rotation.x = pose.pitch;
      rig.rotation.z = Math.PI * 2 * smooth(4.35, 6.35, time);
      rig.scale.set(1 - pose.dive * 0.13, 1 + pose.dive * 0.2, 1 - pose.dive * 0.13);
      const selfie = 1 - smooth(3.3, 4.6, time);
      const flying = smooth(5.7, 7, time) * (1 - pose.cruise);
      head.rotation.z = Math.sin(time * 2.2) * 0.09 * selfie;
      head.rotation.x = -0.2 * flying;
      const wink = smooth(2.12, 2.28, time) * (1 - smooth(2.55, 2.8, time));
      eyes[1].scale.y = 1 - wink * 0.87;
      arms[0].rotation.z = -2.05 * selfie - 1.2 * (1 - selfie);
      arms[1].rotation.z = 1.1 * selfie + 1.2 * (1 - selfie);
      arms[1].rotation.x = -1.1 * selfie;
      arms[0].rotation.x = -0.38 * selfie;
      for (let i = 0; i < 2; i++) {
        legs[i].rotation.x = Math.sin(time * 2.4 + i * Math.PI) * 0.08 * (1 - selfie);
        legs[i].rotation.z = (i ? 1 : -1) * (0.05 + pose.cruise * 0.1);
      }
      for (let i = 0; i < capePositions.count; i++) {
        const x = capeOriginal[i * 3];
        const v = 0.5 - capeOriginal[i * 3 + 1];
        capePositions.setXYZ(i, x * (0.5 + v * 0.75), 1.45 - v * 1.12,
          -0.35 - v * 0.11 + Math.sin(v * 6 - time * 5 + x * 3) * v * (0.035 + flying * 0.07));
      }
      capePositions.needsUpdate = true;
      capeGeometry.computeVertexNormals();
      board.visible = pose.cruise > 0;
      board.scale.setScalar(Math.max(0.001, pose.cruise));
      board.rotation.z = bank.rotation.z * 0.7;
    },
  };
}

export function createJourneyPhone() {
  const group = new THREE.Group();
  const sculpture = createSculpture();
  sculpture.add(group, "box", "#6d6484", [0, 0, 0], [0.67, 1.21, 0.095]);
  sculpture.add(group, "box", "#ebd19b", [0, 0, 0.049], [0.63, 1.17, 0.012]);
  sculpture.add(group, "box", "#38384e", [0, 0.54, 0.069], [0.17, 0.024, 0.013]);
  sculpture.add(group, "sphere", "#444b62", [0.21, 0.43, -0.06], [0.075, 0.075, 0.018]);
  sculpture.add(group, "sphere", "#b8dbe8", [0.21, 0.43, -0.078], [0.04, 0.04, 0.008]);
  sculpture.finish();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Phone viewfinder is unavailable");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.04), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  screen.position.z = 0.063;
  group.add(screen);
  let previousCount = -1;
  const drawScreen = (count: number) => {
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#c0c4ed");
    gradient.addColorStop(1, "#eee4f5");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 512);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 5;
    for (const x of [28, 228]) for (const y of [86, 362]) {
      context.beginPath();
      context.moveTo(x, y + (y < 100 ? 26 : -26));
      context.lineTo(x, y);
      context.lineTo(x + (x < 100 ? 26 : -26), y);
      context.stroke();
    }
    context.fillStyle = "#484167";
    context.textAlign = "center";
    context.font = "bold 108px sans-serif";
    context.fillText(count ? String(count) : "찰칵", 128, 262, 190);
    context.font = "bold 25px sans-serif";
    context.fillText(count === 3 ? "준비!" : count === 2 ? "쁘이~" : count === 1 ? "치즈!" : "동화 속으로", 128, 320);
    context.beginPath();
    context.arc(128, 440, 22, 0, Math.PI * 2);
    context.fillStyle = "#ffffff";
    context.fill();
    texture.needsUpdate = true;
  };
  return {
    group,
    update(time: number, pose: JourneyPose) {
      if (previousCount !== pose.countdown) { previousCount = pose.countdown; drawScreen(pose.countdown); }
      const release = smooth(3.5, 4.55, time);
      group.position.set(0.93 * (1 - release), 1.45 + release * 0.58, 0.32 - release * 5.32);
      group.rotation.set(0, 0.15 * (1 - release), -0.09 * (1 - release));
      group.scale.setScalar(0.8 + release * 4);
      group.visible = time < 6.65;
      screen.visible = time < 4.3;
    },
  };
}
