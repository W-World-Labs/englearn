import { describe, it, expect } from "vitest";
import {
  probabilityCorrect,
  fisherInformation,
  estimateAbility,
  selectNextItem,
  shouldStop,
  thetaToCEFR,
  overallCEFR,
} from "@/lib/irt";
import type { IRTParams, Item, ModuleResult, ModuleType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeItem(
  id: string,
  irt: IRTParams,
  module: ModuleType = "vocabulary"
): Item {
  return {
    id,
    module,
    format: "mcq",
    irt,
    cefr: "B1",
    prompt: `Item ${id}`,
    options: ["a", "b", "c", "d"],
    answerIndex: 0,
  };
}

function moduleResult(module: ModuleType, theta: number): ModuleResult {
  return {
    module,
    theta,
    se: 0.3,
    cefr: thetaToCEFR(theta),
    itemsAdministered: 8,
  };
}

// Seeded deterministic PRNG (mulberry32) so simulated-response tests are stable.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// probabilityCorrect
// ---------------------------------------------------------------------------

describe("probabilityCorrect", () => {
  it("is monotonically increasing in theta", () => {
    const irt: IRTParams = { a: 1.2, b: 0.3 };
    let prev = -Infinity;
    for (let theta = -4; theta <= 4; theta += 0.25) {
      const p = probabilityCorrect(theta, irt);
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });

  it("equals 0.5 (no guessing) when theta == b", () => {
    expect(probabilityCorrect(0.7, { a: 1.5, b: 0.7 })).toBeCloseTo(0.5, 10);
  });

  it("stays within [c, 1]", () => {
    const irt: IRTParams = { a: 1, b: 0, c: 0.25 };
    for (let theta = -6; theta <= 6; theta += 0.5) {
      const p = probabilityCorrect(theta, irt);
      expect(p).toBeGreaterThanOrEqual(0.25 - 1e-9);
      expect(p).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("approaches the guessing floor c as theta -> -inf", () => {
    expect(probabilityCorrect(-20, { a: 1, b: 0, c: 0.2 })).toBeCloseTo(0.2, 4);
  });

  it("approaches 1 as theta -> +inf", () => {
    expect(probabilityCorrect(20, { a: 1, b: 0, c: 0.2 })).toBeCloseTo(1, 4);
  });

  it("defaults c to 0 when omitted", () => {
    expect(probabilityCorrect(-20, { a: 1, b: 0 })).toBeCloseTo(0, 4);
  });
});

// ---------------------------------------------------------------------------
// fisherInformation
// ---------------------------------------------------------------------------

describe("fisherInformation", () => {
  it("peaks at theta == b for the 2PL (c = 0)", () => {
    const irt: IRTParams = { a: 1.5, b: 0.4 };
    const atB = fisherInformation(irt.b, irt);
    for (const offset of [-1.5, -1, -0.5, 0.5, 1, 1.5]) {
      expect(fisherInformation(irt.b + offset, irt)).toBeLessThan(atB);
    }
  });

  it("finds the information peak numerically near b", () => {
    const irt: IRTParams = { a: 1.0, b: -0.6 };
    let bestTheta = -4;
    let bestInfo = -Infinity;
    for (let theta = -4; theta <= 4; theta += 0.01) {
      const info = fisherInformation(theta, irt);
      if (info > bestInfo) {
        bestInfo = info;
        bestTheta = theta;
      }
    }
    // For 2PL the peak is exactly at b.
    expect(bestTheta).toBeCloseTo(irt.b, 1);
  });

  it("scales with a^2 at the difficulty point", () => {
    const lo = fisherInformation(0, { a: 1, b: 0 });
    const hi = fisherInformation(0, { a: 2, b: 0 });
    // At theta=b (2PL): I = a^2 * 0.25, so doubling a quadruples info.
    expect(hi / lo).toBeCloseTo(4, 6);
  });

  it("is non-negative everywhere and does not blow up (guarded)", () => {
    const irt: IRTParams = { a: 1.3, b: 0, c: 0.2 };
    for (let theta = -10; theta <= 10; theta += 0.5) {
      const info = fisherInformation(theta, irt);
      expect(Number.isFinite(info)).toBe(true);
      expect(info).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns finite 0-ish info at extreme low theta (divide-by-zero guard)", () => {
    expect(fisherInformation(-50, { a: 1, b: 0 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// estimateAbility (EAP)
// ---------------------------------------------------------------------------

describe("estimateAbility (EAP)", () => {
  it("returns the prior moments with no items", () => {
    const est = estimateAbility([]);
    expect(est.theta).toBeCloseTo(0, 10);
    expect(est.se).toBeCloseTo(1, 10);
  });

  it("shifts theta positive when answers are mostly correct on hard items", () => {
    const items = [
      { irt: { a: 1.2, b: 1.0 }, correct: true },
      { irt: { a: 1.2, b: 1.2 }, correct: true },
      { irt: { a: 1.2, b: 0.8 }, correct: true },
    ];
    expect(estimateAbility(items).theta).toBeGreaterThan(0.5);
  });

  it("shifts theta negative when answers are mostly wrong on easy items", () => {
    const items = [
      { irt: { a: 1.2, b: -1.0 }, correct: false },
      { irt: { a: 1.2, b: -1.2 }, correct: false },
      { irt: { a: 1.2, b: -0.8 }, correct: false },
    ];
    expect(estimateAbility(items).theta).toBeLessThan(-0.5);
  });

  it("reduces SE as more items are added", () => {
    const few = estimateAbility([
      { irt: { a: 1, b: 0 }, correct: true },
      { irt: { a: 1, b: 0 }, correct: false },
    ]);
    const many = estimateAbility(
      Array.from({ length: 20 }, (_, i) => ({
        irt: { a: 1.3, b: (i % 5) - 2 },
        correct: i % 2 === 0,
      }))
    );
    expect(many.se).toBeLessThan(few.se);
  });

  it("recovers a known theta from simulated 3PL responses", () => {
    const trueTheta = 1.0;
    const rng = makeRng(12345);

    // A spread of items across the difficulty range.
    const itemBank: IRTParams[] = [];
    for (let i = 0; i < 60; i++) {
      itemBank.push({
        a: 0.9 + (i % 5) * 0.2, // 0.9 .. 1.7
        b: -3 + (i / 60) * 6, // -3 .. 3
        c: 0.2,
      });
    }

    const responses = itemBank.map((irt) => {
      const p = probabilityCorrect(trueTheta, irt);
      return { irt, correct: rng() < p };
    });

    const est = estimateAbility(responses);
    // With 60 items EAP should land close to the truth (allow shrinkage to 0).
    expect(est.theta).toBeGreaterThan(0.5);
    expect(est.theta).toBeLessThan(1.5);
    expect(est.se).toBeLessThan(0.4);
  });

  it("recovers a negative known theta from simulated responses", () => {
    const trueTheta = -1.2;
    const rng = makeRng(98765);
    const itemBank: IRTParams[] = Array.from({ length: 60 }, (_, i) => ({
      a: 1.0 + (i % 4) * 0.25,
      b: -3 + (i / 60) * 6,
    }));
    const responses = itemBank.map((irt) => ({
      irt,
      correct: rng() < probabilityCorrect(trueTheta, irt),
    }));
    const est = estimateAbility(responses);
    expect(est.theta).toBeGreaterThan(-1.8);
    expect(est.theta).toBeLessThan(-0.7);
  });

  it("never returns NaN/Infinity even with all-correct or all-wrong runs", () => {
    const allCorrect = estimateAbility(
      Array.from({ length: 10 }, () => ({ irt: { a: 1, b: 0 }, correct: true }))
    );
    const allWrong = estimateAbility(
      Array.from({ length: 10 }, () => ({ irt: { a: 1, b: 0 }, correct: false }))
    );
    for (const est of [allCorrect, allWrong]) {
      expect(Number.isFinite(est.theta)).toBe(true);
      expect(Number.isFinite(est.se)).toBe(true);
    }
    expect(allCorrect.theta).toBeGreaterThan(allWrong.theta);
  });
});

// ---------------------------------------------------------------------------
// selectNextItem
// ---------------------------------------------------------------------------

describe("selectNextItem", () => {
  const bank = [
    makeItem("i1", { a: 1, b: -2 }),
    makeItem("i2", { a: 1, b: 0 }),
    makeItem("i3", { a: 1, b: 2 }),
  ];

  it("picks the item with difficulty closest to theta (max info)", () => {
    expect(selectNextItem(0, bank, [])?.id).toBe("i2");
    expect(selectNextItem(-2, bank, [])?.id).toBe("i1");
    expect(selectNextItem(2, bank, [])?.id).toBe("i3");
  });

  it("skips already-administered items", () => {
    expect(selectNextItem(0, bank, ["i2"])?.id).not.toBe("i2");
  });

  it("returns null when all candidates are administered", () => {
    expect(selectNextItem(0, bank, ["i1", "i2", "i3"])).toBeNull();
  });

  it("returns null for an empty candidate pool", () => {
    expect(selectNextItem(0, [], [])).toBeNull();
  });

  it("prefers higher discrimination at equal difficulty", () => {
    const tie = [
      makeItem("low", { a: 0.8, b: 0 }),
      makeItem("high", { a: 1.8, b: 0 }),
    ];
    expect(selectNextItem(0, tie, [])?.id).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// shouldStop
// ---------------------------------------------------------------------------

describe("shouldStop", () => {
  it("does not stop before minItems regardless of SE", () => {
    expect(shouldStop({ theta: 0, se: 0.1 }, 4)).toBe(false);
  });

  it("stops at minItems boundary when SE is at/under threshold", () => {
    expect(shouldStop({ theta: 0, se: 0.35 }, 5)).toBe(true);
    expect(shouldStop({ theta: 0, se: 0.3 }, 5)).toBe(true);
  });

  it("does not stop at minItems when SE is above threshold", () => {
    expect(shouldStop({ theta: 0, se: 0.36 }, 5)).toBe(false);
  });

  it("always stops at maxItems even with large SE", () => {
    expect(shouldStop({ theta: 0, se: 0.9 }, 15)).toBe(true);
    expect(shouldStop({ theta: 0, se: 0.9 }, 16)).toBe(true);
  });

  it("does not stop just below maxItems with large SE", () => {
    expect(shouldStop({ theta: 0, se: 0.9 }, 14)).toBe(false);
  });

  it("honors custom option overrides", () => {
    expect(
      shouldStop({ theta: 0, se: 0.5 }, 3, {
        minItems: 3,
        maxItems: 10,
        seThreshold: 0.5,
      })
    ).toBe(true);
    expect(
      shouldStop({ theta: 0, se: 0.51 }, 3, {
        minItems: 3,
        maxItems: 10,
        seThreshold: 0.5,
      })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// thetaToCEFR
// ---------------------------------------------------------------------------

describe("thetaToCEFR", () => {
  it("maps boundary values to the lower-inclusive band", () => {
    expect(thetaToCEFR(-1.5)).toBe("A1");
    expect(thetaToCEFR(-0.5)).toBe("A2");
    expect(thetaToCEFR(0.5)).toBe("B1");
    expect(thetaToCEFR(1.5)).toBe("B2");
    expect(thetaToCEFR(2.5)).toBe("C1");
  });

  it("maps values inside each band", () => {
    expect(thetaToCEFR(-3)).toBe("A1");
    expect(thetaToCEFR(-1)).toBe("A2");
    expect(thetaToCEFR(0)).toBe("B1");
    expect(thetaToCEFR(1)).toBe("B2");
    expect(thetaToCEFR(2)).toBe("C1");
    expect(thetaToCEFR(3)).toBe("C2");
  });

  it("maps just-above-boundary values to the higher band", () => {
    expect(thetaToCEFR(-1.49)).toBe("A2");
    expect(thetaToCEFR(-0.49)).toBe("B1");
    expect(thetaToCEFR(0.51)).toBe("B2");
    expect(thetaToCEFR(1.51)).toBe("C1");
    expect(thetaToCEFR(2.51)).toBe("C2");
  });
});

// ---------------------------------------------------------------------------
// overallCEFR
// ---------------------------------------------------------------------------

describe("overallCEFR", () => {
  it("returns A1 for no modules", () => {
    expect(overallCEFR([])).toBe("A1");
  });

  it("maps a single module's theta directly", () => {
    expect(overallCEFR([moduleResult("reading", 1.0)])).toBe("B2");
  });

  it("uses the median theta (robust to one outlier)", () => {
    const modules = [
      moduleResult("vocabulary", 0.6),
      moduleResult("grammar", 0.7),
      moduleResult("reading", 3.5), // outlier
    ];
    // median theta = 0.7 -> B2
    expect(overallCEFR(modules)).toBe("B2");
  });

  it("averages the two central thetas for an even count", () => {
    const modules = [
      moduleResult("vocabulary", -0.4),
      moduleResult("grammar", 0.4),
    ];
    // median = (-0.4 + 0.4)/2 = 0 -> B1
    expect(overallCEFR(modules)).toBe("B1");
  });
});
