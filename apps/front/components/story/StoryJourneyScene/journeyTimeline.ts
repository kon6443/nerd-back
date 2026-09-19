export type JourneyStage = "selfie" | "portal" | "kingdom" | "starlight" | "cruise";
type Point = [number, number, number];

export const JOURNEY_CAPTIONS: Record<JourneyStage, { title: string; detail: string }> = {
  selfie: { title: "동화 속 주인공, 준비됐나요?", detail: "셋, 둘, 하나. 가장 멋진 표정을 지어 봐요." },
  portal: { title: "작은 화면 너머, 커다란 모험", detail: "반짝이는 문을 지나 동화나라로 떠나요." },
  kingdom: { title: "망토를 펼치고, 숲 위로 훨훨", detail: "분홍빛 성과 작은 숲이 우리를 반겨요." },
  starlight: { title: "별빛을 따라 조금 더 높이", detail: "마법 등불이 구름으로 가는 길을 비춰요." },
  cruise: { title: "구름을 타고 이야기 속으로", detail: "살짝 움직여 보세요. 구름도 함께 춤춰요." },
};

export interface JourneyPose {
  stage: JourneyStage;
  hero: Point;
  camera: Point;
  target: Point;
  yaw: number;
  pitch: number;
  bank: number;
  dive: number;
  cruise: number;
  flash: number;
  countdown: number;
}

export const smooth = (from: number, to: number, time: number) => {
  const x = Math.max(0, Math.min(1, (time - from) / (to - from)));
  return x * x * (3 - 2 * x);
};

export function cloudOffset(travel: number, row: number): number {
  // Clouds approach the camera, then recycle only once they are behind it.
  return 20 - (((row * 22 - travel + 20) % 88 + 88) % 88);
}

// Positions and velocities are in world units/seconds. Matching tangents keep
// the chase continuous at scene boundaries, independently of frame rate.
const path: { time: number; position: Point; velocity: Point }[] = [
  { time: 0, position: [0, 0, 0], velocity: [0, 0, 0] },
  { time: 3.5, position: [0, 0, 0], velocity: [0, 0, 0] },
  { time: 4.15, position: [0, 0.15, 0.5], velocity: [0, 0, 0] },
  { time: 6.5, position: [0, 3, -13], velocity: [-0.6, 0.1, -7] },
  { time: 9, position: [-2, 3.4, -30], velocity: [0, 0.2, -7] },
  { time: 12, position: [1, 4, -52], velocity: [0.3, 1.2, -7.5] },
  { time: 16, position: [0, 22, -82], velocity: [0, 0, -7.5] },
];

export function createJourneyPose(): JourneyPose {
  return { stage: "selfie", hero: [0, 0, 0], camera: [0, 0, 0], target: [0, 0, 0], yaw: 0, pitch: 0, bank: 0, dive: 0, cruise: 0, flash: 0, countdown: 3 };
}

export function sampleJourney(time: number, pose: JourneyPose): JourneyPose {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  pose.stage = t < 3.5 ? "selfie" : t < 6.5 ? "portal" : t < 12 ? "kingdom" : t < 16 ? "starlight" : "cruise";
  if (t >= 16) {
    const cruiseTime = t - 16;
    const sway = smooth(0, 3, cruiseTime);
    pose.hero[0] = Math.sin(cruiseTime * 0.32) * 1.15 * sway;
    pose.hero[1] = 22 + Math.sin(cruiseTime * 0.85) * 0.22 * sway;
    pose.hero[2] = -82 - cruiseTime * 7.5;
  } else {
    const index = path.findIndex((key, i) => i < path.length - 1 && t < path[i + 1].time);
    const a = path[Math.max(0, index)];
    const b = path[Math.max(0, index) + 1];
    const duration = b.time - a.time;
    const u = (t - a.time) / duration;
    const u2 = u * u;
    const u3 = u2 * u;
    for (let axis = 0; axis < 3; axis++) {
      pose.hero[axis] = (2 * u3 - 3 * u2 + 1) * a.position[axis]
        + (u3 - 2 * u2 + u) * duration * a.velocity[axis]
        + (-2 * u3 + 3 * u2) * b.position[axis]
        + (u3 - u2) * duration * b.velocity[axis];
    }
  }
  const turn = smooth(3.5, 4.65, t);
  const flight = smooth(5.8, 7.4, t);
  pose.cruise = smooth(14.3, 16.8, t);
  pose.dive = smooth(4.15, 4.9, t) * (1 - smooth(5.6, 6.5, t));
  pose.yaw = -0.15 + (Math.PI + 0.15) * turn - pose.cruise * 0.2;
  pose.pitch = -0.24 * smooth(3.5, 4.1, t) * (1 - smooth(4.1, 4.5, t))
    + (Math.PI / 2) * smooth(4.15, 5, t) * (1 - flight) + 0.96 * flight * (1 - pose.cruise) + 0.12 * pose.cruise;
  pose.bank = Math.sin((t - 6.5) * 0.85) * 0.18 * smooth(6.5, 7.5, t) * (1 - pose.cruise)
    + Math.sin((t - 16) * 0.32) * 0.1 * pose.cruise;
  pose.countdown = t < 0.8 ? 3 : t < 1.6 ? 2 : t < 2.4 ? 1 : 0;
  pose.flash = smooth(2.4, 2.46, t) * (1 - smooth(2.46, 2.85, t)) * 0.65;
  const chase = smooth(2.9, 6.5, t);
  pose.camera[0] = pose.hero[0] + 3.9 * (1 - chase);
  pose.camera[1] = pose.hero[1] + 2.8 + pose.cruise * 0.35;
  pose.camera[2] = pose.hero[2] + 6.8 + chase * 1.6 + pose.cruise * 0.5;
  pose.target[0] = pose.hero[0];
  pose.target[1] = pose.hero[1] + 1.3;
  pose.target[2] = pose.hero[2];
  return pose;
}
