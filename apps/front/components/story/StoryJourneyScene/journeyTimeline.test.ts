import { describe, expect, it } from "vitest";
import { cloudOffset, createJourneyPose, sampleJourney } from "./journeyTimeline";

describe("cinematic journey timeline", () => {
  it("moves clouds towards the camera and recycles a bounded field behind it", () => {
    expect(cloudOffset(8.5, 1) - cloudOffset(1, 1)).toBeCloseTo(7.5);
    expect(cloudOffset(20 - 0.001, 0)).toBeCloseTo(20, 2);
    expect(cloudOffset(20 + 0.001, 0)).toBeCloseTo(-68, 2);
    for (const distance of [0, 200, 10000]) {
      for (let row = 0; row < 4; row++) {
        expect(cloudOffset(distance, row)).toBeGreaterThanOrEqual(-68);
        expect(cloudOffset(distance, row)).toBeLessThanOrEqual(20);
        expect(cloudOffset(distance + 88, row)).toBe(cloudOffset(distance, row));
      }
    }
  });
  it("follows the requested five scenes and stays in cruise after 16 seconds", () => {
    const pose = createJourneyPose();
    expect([0, 3.5, 6.5, 12, 16, 600].map(t => sampleJourney(t, pose).stage))
      .toEqual(["selfie", "portal", "kingdom", "starlight", "cruise", "cruise"]);
  });
  it.each([3.5, 4.15, 6.5, 9, 12, 16, 16.8])("keeps camera and character continuous at %s seconds", boundary => {
    const before = sampleJourney(boundary - 0.0001, createJourneyPose());
    const after = sampleJourney(boundary + 0.0001, createJourneyPose());
    for (const field of ["hero", "camera", "target"] as const) {
      before[field].forEach((value, axis) => expect(Math.abs(value - after[field][axis])).toBeLessThan(0.003));
    }
    for (const field of ["pitch", "yaw", "bank", "cruise", "dive"] as const) {
      expect(Math.abs(before[field] - after[field])).toBeLessThan(0.003);
    }
  });
  it("does one countdown and one softened flash, never repeating during cruise", () => {
    const pose = createJourneyPose();
    expect([0, 0.8, 1.6, 2.4].map(t => sampleJourney(t, pose).countdown)).toEqual([3, 2, 1, 0]);
    expect(sampleJourney(2.46, pose).flash).toBeCloseTo(0.65);
    for (const t of [0, 2.3, 2.9, 16, 60, 600]) expect(sampleJourney(t, pose).flash).toBe(0);
  });
  it("is deterministic after pause/resume and reuses its output without frame history", () => {
    const pose = createJourneyPose();
    sampleJourney(60, pose);
    expect(sampleJourney(8, pose)).toBe(pose);
    expect(pose).toEqual(sampleJourney(8, createJourneyPose()));
    expect(sampleJourney(-1, pose)).toEqual(sampleJourney(0, createJourneyPose()));
    expect(sampleJourney(Number.NaN, pose)).toEqual(sampleJourney(0, createJourneyPose()));
  });
});
