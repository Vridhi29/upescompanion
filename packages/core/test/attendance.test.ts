import { describe, expect, it } from "vitest";
import {
  alertLevel,
  classifyAttendanceProvenance,
  AttendanceInputError,
  classesToRecover,
  maxMissable,
  overall,
  percentage,
  project,
  simulateAbsences,
  summarize,
} from "../src";

describe("percentage", () => {
  it("computes attended / conducted", () => {
    expect(percentage({ attended: 36, conducted: 40 })).toBe(90);
  });
  it("returns null when nothing conducted", () => {
    expect(percentage({ attended: 0, conducted: 0 })).toBeNull();
  });
  it("rejects invalid counts", () => {
    expect(() => percentage({ attended: 5, conducted: 4 })).toThrow(AttendanceInputError);
    expect(() => percentage({ attended: -1, conducted: 4 })).toThrow(AttendanceInputError);
    expect(() => percentage({ attended: 1.5, conducted: 4 })).toThrow(AttendanceInputError);
  });
});

describe("maxMissable (bunk calculator)", () => {
  it("is exact at the boundary", () => {
    expect(maxMissable({ attended: 36, conducted: 40 }, 75)).toBe(8); // 36/48 = 75%
    expect(36 / 48).toBe(0.75);
    expect(36 / 49).toBeLessThan(0.75);
  });
  it("is 0 when exactly on target", () => {
    expect(maxMissable({ attended: 30, conducted: 40 }, 75)).toBe(0);
  });
  it("is 0 when already below target", () => {
    expect(maxMissable({ attended: 28, conducted: 40 }, 75)).toBe(0);
  });
  it("matches brute force for many inputs", () => {
    for (let conducted = 1; conducted <= 60; conducted++) {
      for (let attended = 0; attended <= conducted; attended++) {
        for (const target of [75, 77.5, 78, 80, 85]) {
          const got = maxMissable({ attended, conducted }, target);
          const atOrAbove = attended * 100 >= target * conducted - 1e-9;
          let brute = 0;
          if (atOrAbove) {
            while (attended * 100 >= target * (conducted + brute + 1) - 1e-9) brute++;
          }
          expect(got).toBe(brute);
        }
      }
    }
  });
});

describe("classesToRecover (recovery calculator)", () => {
  it("computes minimum consecutive classes", () => {
    expect(classesToRecover({ attended: 28, conducted: 40 }, 75)).toBe(8); // 36/48
    expect(classesToRecover({ attended: 30, conducted: 40 }, 80)).toBe(10); // 40/50
  });
  it("is 0 when already at target", () => {
    expect(classesToRecover({ attended: 30, conducted: 40 }, 75)).toBe(0);
  });
  it("is the true minimum (brute force)", () => {
    for (let conducted = 1; conducted <= 50; conducted++) {
      for (let attended = 0; attended <= conducted; attended++) {
        for (const target of [75, 78, 80, 90]) {
          const y = classesToRecover({ attended, conducted }, target);
          expect(y).not.toBeNull();
          const ok = (n: number) => (attended + n) * 100 >= target * (conducted + n) - 1e-9;
          expect(ok(y!)).toBe(true);
          if (y! > 0) expect(ok(y! - 1)).toBe(false);
        }
      }
    }
  });
  it("is unreachable for a 100% target after a miss", () => {
    expect(classesToRecover({ attended: 9, conducted: 10 }, 100)).toBeNull();
    expect(classesToRecover({ attended: 10, conducted: 10 }, 100)).toBe(0);
  });
});

describe("projection and simulation", () => {
  it("projects attend/miss plans", () => {
    const p = project({ attended: 30, conducted: 40 }, { attend: 5, miss: 5 });
    expect(p.counts).toEqual({ attended: 35, conducted: 50 });
    expect(p.percentage).toBe(70);
  });
  it("simulates absences in date order", () => {
    const steps = simulateAbsences({ attended: 8, conducted: 10 }, [
      { date: "2026-11-20", absent: true },
      { date: "2026-11-18", absent: false },
    ]);
    expect(steps.map((s) => s.date)).toEqual(["2026-11-18", "2026-11-20"]);
    expect(steps[0]!.counts).toEqual({ attended: 9, conducted: 11 });
    expect(steps[1]!.counts).toEqual({ attended: 9, conducted: 12 });
  });
});

describe("overall", () => {
  it("aggregates by total classes, not mean of percentages", () => {
    const res = overall([
      { attended: 10, conducted: 10 },
      { attended: 10, conducted: 40 },
    ]);
    expect(res.counts).toEqual({ attended: 20, conducted: 50 });
    expect(res.percentage).toBe(40);
  });
});

describe("alertLevel", () => {
  it("classifies levels", () => {
    expect(alertLevel(null)).toBe("no_data");
    expect(alertLevel(74.9)).toBe("below_minimum");
    expect(alertLevel(75)).toBe("approaching_minimum");
    expect(alertLevel(76.9)).toBe("approaching_minimum");
    expect(alertLevel(77)).toBe("below_personal");
    expect(alertLevel(79.9)).toBe("below_personal");
    expect(alertLevel(80)).toBe("ok");
  });
});

describe("attendance provenance", () => {
  it("distinguishes sample, account, mixed, unknown, and empty result sets", () => {
    expect(classifyAttendanceProvenance(["mock", "mock"])).toBe("sample");
    expect(classifyAttendanceProvenance(["synced", "manual"])).toBe("account");
    expect(classifyAttendanceProvenance(["mock", "synced"])).toBe("mixed");
    expect(classifyAttendanceProvenance(["mock", undefined])).toBe("unknown");
    expect(classifyAttendanceProvenance(["synced", "unexpected-source"])).toBe("unknown");
    expect(classifyAttendanceProvenance(["manual", null])).toBe("unknown");
    expect(classifyAttendanceProvenance([])).toBe("empty");
  });
});

describe("summarize", () => {
  it("bundles the numbers a dashboard row needs", () => {
    const s = summarize({ attended: 36, conducted: 40 }, 75);
    expect(s).toMatchObject({ percentage: 90, missed: 4, canMiss: 8, mustAttend: 0, alert: "ok" });
    expect(s.marginPoints).toBe(15);
  });
});
