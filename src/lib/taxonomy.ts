/** Fixed taxonomy shared by AI schema, routing, filters and UI. Client-safe (no server imports). */

export const CATEGORIES = [
  "ROADS",
  "WASTE",
  "WATER_SUPPLY",
  "STREETLIGHTING",
  "ELECTRICAL_HAZARDS",
  "TREES",
  "STORMWATER_DRAINAGE",
  "SEWERAGE",
  "OTHER",
] as const;
export type CategoryCode = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<CategoryCode, string> = {
  ROADS: "Roads",
  WASTE: "Waste",
  WATER_SUPPLY: "Water Supply",
  STREETLIGHTING: "Streetlighting",
  ELECTRICAL_HAZARDS: "Electrical Hazards",
  TREES: "Trees",
  STORMWATER_DRAINAGE: "Stormwater Drainage",
  SEWERAGE: "Sewerage",
  OTHER: "Other",
};

export const SUBTYPES = {
  pothole: { category: "ROADS", label: "Pothole" },
  damaged_road: { category: "ROADS", label: "Damaged road surface" },
  road_obstruction: { category: "ROADS", label: "Road obstruction" },
  overflowing_bin: { category: "WASTE", label: "Overflowing bin" },
  illegal_dumping: { category: "WASTE", label: "Illegal dumping" },
  missed_collection: { category: "WASTE", label: "Missed collection" },
  water_leak: { category: "WATER_SUPPLY", label: "Water supply leak" },
  no_water_supply: { category: "WATER_SUPPLY", label: "No water supply" },
  contaminated_water: { category: "WATER_SUPPLY", label: "Contaminated water" },
  streetlight_out: { category: "STREETLIGHTING", label: "Streetlight out" },
  streetlight_damaged: { category: "STREETLIGHTING", label: "Damaged streetlight" },
  downed_wire: { category: "ELECTRICAL_HAZARDS", label: "Downed wire" },
  sparking_wire: { category: "ELECTRICAL_HAZARDS", label: "Sparking wire" },
  exposed_electrical: { category: "ELECTRICAL_HAZARDS", label: "Exposed electrical equipment" },
  fallen_tree: { category: "TREES", label: "Fallen tree" },
  hazardous_tree: { category: "TREES", label: "Hazardous tree or branch" },
  blocked_drain: { category: "STORMWATER_DRAINAGE", label: "Blocked drain" },
  waterlogging: { category: "STORMWATER_DRAINAGE", label: "Waterlogging" },
  sewage_overflow: { category: "SEWERAGE", label: "Sewage overflow" },
  blocked_sewer: { category: "SEWERAGE", label: "Blocked sewer" },
  other: { category: "OTHER", label: "Other / unclear" },
} as const satisfies Record<string, { category: CategoryCode; label: string }>;

export type Subtype = keyof typeof SUBTYPES;
export const SUBTYPE_CODES = Object.keys(SUBTYPES) as Subtype[];

export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type SeverityCode = (typeof SEVERITIES)[number];
export const SEVERITY_RANK: Record<SeverityCode, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
export const SEVERITY_LABEL: Record<SeverityCode, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const TICKET_STATUSES = [
  "NEW",
  "NEEDS_REVIEW",
  "WAITING_FOR_DETAILS",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
] as const;
export type TicketStatusCode = (typeof TICKET_STATUSES)[number];
export const STATUS_LABEL: Record<TicketStatusCode, string> = {
  NEW: "New",
  NEEDS_REVIEW: "Needs review",
  WAITING_FOR_DETAILS: "Waiting for details",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};
/** Citizen-facing wording (never exposes internal review reasons). */
export const PUBLIC_STATUS_LABEL: Record<TicketStatusCode, string> = {
  NEW: "Received by the city",
  NEEDS_REVIEW: "Being reviewed",
  WAITING_FOR_DETAILS: "We need a detail from you",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "Work in progress",
  RESOLVED: "Resolved",
};

export const HAZARD_FACTORS = [
  "immediate_danger_to_people",
  "electrical_contact_risk",
  "major_obstruction",
  "significant_hazard",
  "service_disruption",
  "vulnerable_location",
  "public_space_affected",
  "limited_impact",
] as const;
export type HazardFactor = (typeof HAZARD_FACTORS)[number];

export function subtypeLabel(s: string) {
  return (SUBTYPES as Record<string, { label: string }>)[s]?.label ?? s;
}
export function categoryOf(s: string): CategoryCode {
  return (SUBTYPES as Record<string, { category: CategoryCode }>)[s]?.category ?? "OTHER";
}
export function isSubtype(s: string): s is Subtype {
  return s in SUBTYPES;
}
