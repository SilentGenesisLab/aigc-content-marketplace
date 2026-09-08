import { describe, expect, it } from "vitest";
import { nextDeliveryVersion, reputation, subOrderCode } from "./business";

describe("marketplace business rules", () => {
  it("never invents reputation for a new creator", () => {
    expect(reputation(0, 0, [])).toEqual({ completed: 0, onTimeRate: null, averageRating: null, reviewCount: 0 });
  });

  it("calculates real reputation", () => {
    expect(reputation(4, 3, [{ rating: 5 }, { rating: 4 }])).toEqual({ completed: 4, onTimeRate: 75, averageRating: 4.5, reviewCount: 2 });
  });

  it("increments immutable delivery versions", () => {
    expect(nextDeliveryVersion([{ version: 1 }, { version: 3 }])).toBe(4);
    expect(subOrderCode("ORD-260908-TEST", 2)).toBe("ORD-260908-TEST-02");
  });
});
