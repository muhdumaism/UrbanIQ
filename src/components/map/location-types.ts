export type PickedLocation = {
  lat: number | null;
  lng: number | null;
  source: "DEVICE" | "PIN" | "LANDMARK" | "NONE";
  text: string;
  confirmed: boolean;
  /** Google Place ID when the citizen picked a search result (Google data is not stored otherwise). */
  placeId?: string | null;
};

export const EMPTY_LOCATION: PickedLocation = { lat: null, lng: null, source: "NONE", text: "", confirmed: false, placeId: null };
