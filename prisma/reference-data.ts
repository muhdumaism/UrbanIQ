/** Reference data: departments and default routing rules (subtype, department code, optional ward). Edit to fit your municipality. */
export const DEPARTMENTS = [
  { code: "ROADS", name: "Roads Maintenance" },
  { code: "WASTE", name: "Solid Waste Management" },
  { code: "WATER", name: "Water Supply" },
  { code: "LIGHTS", name: "Streetlighting Maintenance" },
  { code: "ELEC", name: "Electrical Response" },
  { code: "TREES", name: "Tree Response" },
  { code: "DRAIN", name: "Stormwater Drainage" },
  { code: "SEWER", name: "Sewerage" },
  { code: "HARBOUR", name: "Harbour Estates Office" },
];

export const RULES: [string, string, string?][] = [
  ["pothole", "ROADS"],
  ["damaged_road", "ROADS"],
  ["road_obstruction", "ROADS"],
  ["overflowing_bin", "WASTE"],
  ["illegal_dumping", "WASTE"],
  ["missed_collection", "WASTE"],
  ["garbage", "WASTE"],
  ["water_leak", "WATER"],
  ["no_water_supply", "WATER"],
  ["contaminated_water", "WATER"],
  ["streetlight_out", "LIGHTS"],
  ["streetlight_damaged", "LIGHTS"],
  ["downed_wire", "ELEC"],
  ["sparking_wire", "ELEC"],
  ["exposed_electrical", "ELEC"],
  ["fallen_tree", "TREES"],
  ["hazardous_tree", "TREES"],
  ["blocked_drain", "DRAIN"],
  ["waterlogging", "DRAIN"],
  ["sewage_overflow", "SEWER"],
  ["blocked_sewer", "SEWER"],
  // Sample ward override: harbour-front lighting is maintained by the Harbour Estates Office.
  ["streetlight_out", "HARBOUR", "W1"],
  ["streetlight_damaged", "HARBOUR", "W1"],
];
