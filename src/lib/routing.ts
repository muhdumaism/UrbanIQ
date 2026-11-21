/** Department routing is a configurable lookup owned by the backend. The AI never assigns departments. */
export type RuleRow = { subtype: string; wardCode: string; departmentId: string; active: boolean };

export type RoutingDecision =
  | { status: "routed"; departmentId: string; ruleScope: "ward" | "citywide" }
  | { status: "uncertain"; reason: string };

/**
 * Most specific active rule wins: (subtype, ward) before (subtype, "*").
 * If the ward is unknown and ward-specific overrides exist for the subtype, ownership is uncertain.
 */
export function resolveRoute(rules: RuleRow[], subtype: string, wardCode: string | null): RoutingDecision {
  const active = rules.filter((r) => r.active && r.subtype === subtype);
  if (!active.length) return { status: "uncertain", reason: `No routing rule for "${subtype}"` };
  if (wardCode) {
    const ward = active.find((r) => r.wardCode === wardCode);
    if (ward) return { status: "routed", departmentId: ward.departmentId, ruleScope: "ward" };
  }
  const citywide = active.find((r) => r.wardCode === "*");
  const overrides = active.filter((r) => r.wardCode !== "*");
  if (!wardCode && overrides.length && citywide && overrides.some((o) => o.departmentId !== citywide.departmentId)) {
    return { status: "uncertain", reason: "Owner depends on ward, and the ward is unknown" };
  }
  if (citywide) return { status: "routed", departmentId: citywide.departmentId, ruleScope: "citywide" };
  return { status: "uncertain", reason: wardCode ? `No rule for "${subtype}" in ${wardCode}` : "Ward unknown" };
}
