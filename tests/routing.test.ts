import { describe, expect, it } from "vitest";
import { resolveRoute, type RuleRow } from "@/lib/routing";
import { findLandmark, LANDMARKS, wardForPoint } from "@/lib/geo";

const rules: RuleRow[] = [
  { subtype: "pothole", wardCode: "*", departmentId: "roads", active: true },
  { subtype: "streetlight_out", wardCode: "*", departmentId: "lights", active: true },
  { subtype: "streetlight_out", wardCode: "W1", departmentId: "harbour", active: true },
  { subtype: "water_leak", wardCode: "*", departmentId: "water", active: false },
];

describe("ward lookup", () => {
  it("derives the ward from a point inside the sample boundaries", () => {
    for (const lm of LANDMARKS) expect(wardForPoint(lm.lat, lm.lng)).toBe(lm.wardCode);
  });
  it("returns null outside the city", () => {
    expect(wardForPoint(51.5, -0.12)).toBeNull();
  });
  it("matches typed landmarks, preferring the most specific alias", () => {
    expect(findLandmark("outside alder primary school gate")?.name).toBe("Alder Primary School");
    expect(findLandmark("near the school")).toBeNull();
  });
});

describe("routing rules", () => {
  it("uses the city-wide rule by subtype", () => {
    expect(resolveRoute(rules, "pothole", "W3")).toEqual({ status: "routed", departmentId: "roads", ruleScope: "citywide" });
  });
  it("a ward-specific rule beats the city-wide rule", () => {
    expect(resolveRoute(rules, "streetlight_out", "W1")).toMatchObject({ departmentId: "harbour", ruleScope: "ward" });
    expect(resolveRoute(rules, "streetlight_out", "W4")).toMatchObject({ departmentId: "lights" });
  });
  it("ownership is uncertain when the owner depends on an unknown ward", () => {
    expect(resolveRoute(rules, "streetlight_out", null).status).toBe("uncertain");
    expect(resolveRoute(rules, "pothole", null)).toMatchObject({ status: "routed", departmentId: "roads" });
  });
  it("unknown subtypes and inactive rules go to review", () => {
    expect(resolveRoute(rules, "other", "W2").status).toBe("uncertain");
    expect(resolveRoute(rules, "water_leak", "W2").status).toBe("uncertain");
  });
});
