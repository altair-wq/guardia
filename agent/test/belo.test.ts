import { describe, expect, it } from "vitest";
import { beloBratPerArgt } from "../src/quote.js";

// Shape and values captured from GET https://api.belo.app/public/price on Nov 7, 2026.
const SAMPLE = [
  { ask: "302.56410256410256404", bid: "293.89587073608617588", baseId: "131", quoteId: "132", pairCode: "BRAt/ARGt", spread: "2.8649240787511791382" },
  { ask: "1652", bid: "1610", baseId: "6", quoteId: "132", pairCode: "USDT/ARGt", spread: "2.5" },
  { ask: "5.55", bid: "5.40", baseId: "6", quoteId: "131", pairCode: "USDT/BRAt", spread: "2.7" },
];

describe("Belo reference price", () => {
  it("uses the direct BRAt/ARGt pair (mid of ask and bid)", () => {
    const mid = (302.56410256410256404 + 293.89587073608617588) / 2;
    expect(beloBratPerArgt(SAMPLE)).toBeCloseTo(1 / mid, 10);
  });

  it("falls back to the USDT cross rate when the direct pair is missing", () => {
    const r = beloBratPerArgt(SAMPLE.filter((e) => e.pairCode !== "BRAt/ARGt"));
    expect(r).toBeCloseTo(((5.55 + 5.4) / 2) / ((1652 + 1610) / 2), 10);
  });

  it("returns null for unexpected shapes", () => {
    expect(beloBratPerArgt({ data: SAMPLE })).toBeNull();
    expect(beloBratPerArgt([{ pairCode: "USDT/ARGt", ask: "x", bid: "y" }])).toBeNull();
    expect(beloBratPerArgt([])).toBeNull();
  });

  it("agrees roughly with the Curve pools (about 300 ARGt per BRAt)", () => {
    const r = beloBratPerArgt(SAMPLE)!;
    expect(1 / r).toBeGreaterThan(250);
    expect(1 / r).toBeLessThan(350);
  });
});
