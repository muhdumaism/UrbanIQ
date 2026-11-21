/*
 * TEST STUB of the Google Maps JavaScript API — NOT Google. Served by Playwright in place of
 * https://maps.googleapis.com/maps/api/js so UrbanIQ's integration code (Places search → pin →
 * confirm, draggable marker, ward overlay, officer pins + info window) can be exercised offline.
 * It implements only the surface UrbanIQ uses, with a simple linear projection.
 */
(function () {
  const params = new URL(document.currentScript.src).searchParams;
  window.__gmapsRequest = Object.fromEntries(params.entries());
  const PLACES = [
    { id: "ChIJstub_millbrook_park_0001", name: "Millbrook Park", lat: -30.010811, lng: -19.971993 },
    { id: "ChIJstub_alder_primary_00001", name: "Alder Primary School", lat: -30.01036, lng: -19.991909 },
    { id: "ChIJstub_big_ben_london_0001", name: "Big Ben, London", lat: 51.5007, lng: -0.1246 },
    { id: "ChIJstub_india_gate_delhi_01", name: "India Gate, New Delhi", lat: 28.6129, lng: 77.2295 },
    { id: "ChIJstub_connaught_place_001", name: "Connaught Place, New Delhi", lat: 28.6315, lng: 77.2167 },
    { id: "ChIJstub_gateway_mumbai_0001", name: "Gateway of India, Mumbai", lat: 18.922, lng: 72.8347 },
  ];
  const listeners = (obj) => (obj.__l ||= {});
  const addListener = function (ev, fn) {
    (listeners(this)[ev] ||= []).push(fn);
    return { remove() {} };
  };
  const fire = (obj, ev, arg) => (listeners(obj)[ev] || []).forEach((f) => f(arg));

  class LatLng {
    constructor(lat, lng) { this._lat = typeof lat === "object" ? lat.lat : lat; this._lng = typeof lat === "object" ? lat.lng : lng; }
    lat() { return this._lat; }
    lng() { return this._lng; }
  }
  class LatLngBounds {
    constructor() { this.s = 90; this.n = -90; this.w = 180; this.e = -180; }
    extend(p) { const lat = typeof p.lat === "function" ? p.lat() : p.lat; const lng = typeof p.lng === "function" ? p.lng() : p.lng; this.s = Math.min(this.s, lat); this.n = Math.max(this.n, lat); this.w = Math.min(this.w, lng); this.e = Math.max(this.e, lng); return this; }
  }
  class Map {
    constructor(div, opts) {
      this.div = div; this.opts = opts; this.zoom = 13; this.center = opts.center || { lat: 0, lng: 0 }; this.span = 0.08;
      div.style.position = "relative"; div.style.background = "#1b232b"; div.dataset.stub = "google-maps-stub";
      this.layer = document.createElement("div"); this.layer.style.cssText = "position:absolute;inset:0;overflow:hidden";
      const credit = document.createElement("div"); credit.textContent = "Map stub (tests) — not Google"; credit.style.cssText = "position:absolute;right:4px;bottom:2px;font:10px sans-serif;color:#aaa";
      div.append(this.layer, credit);
      div.__gmap = this;
      this.data = { addGeoJson: (fc) => { this.geo = fc; }, setStyle: () => {} };
      div.addEventListener("click", (e) => {
        if (e.target !== div && e.target !== this.layer) return;
        const r = div.getBoundingClientRect();
        fire(this, "click", { latLng: this.unproject(e.clientX - r.left, e.clientY - r.top) });
      });
    }
    addListener(ev, fn) { return addListener.call(this, ev, fn); }
    fitBounds(b) { this.center = { lat: (b.s + b.n) / 2, lng: (b.w + b.e) / 2 }; this.span = Math.max(b.n - b.s, b.e - b.w) * 1.2 || 0.08; this.redraw(); }
    setCenter(p) { this.panTo(p); }
    getBounds() {
      const r = this.div.getBoundingClientRect();
      const ne = this.unproject(r.width, 0), sw = this.unproject(0, r.height);
      return { getNorthEast: () => ne, getSouthWest: () => sw };
    }
    panTo(p) { this.center = { lat: typeof p.lat === "function" ? p.lat() : p.lat, lng: typeof p.lng === "function" ? p.lng() : p.lng }; this.redraw(); }
    setZoom(z) { this.span = this.span * Math.pow(2, this.zoom - z); this.zoom = z; this.redraw(); }
    getZoom() { return this.zoom; }
    project(lat, lng) { const r = this.div.getBoundingClientRect(); const s = Math.max(r.width, r.height) / this.span; return { x: r.width / 2 + (lng - this.center.lng) * s, y: r.height / 2 - (lat - this.center.lat) * s }; }
    unproject(x, y) { const r = this.div.getBoundingClientRect(); const s = Math.max(r.width, r.height) / this.span; return new LatLng(this.center.lat - (y - r.height / 2) / s, this.center.lng + (x - r.width / 2) / s); }
    redraw() { (this.markers || []).forEach((m) => m._place()); (this.overlays || []).forEach((o) => o.draw()); fire(this, "idle"); }
  }
  class AdvancedMarkerElement {
    constructor(o = {}) { this.content = o.content || document.createElement("div"); this.gmpDraggable = o.gmpDraggable; this.title = o.title; this.zIndex = 0; this.wrap = document.createElement("div"); this.wrap.style.cssText = "position:absolute;transform:translate(-50%,-100%)"; this.wrap.dataset.stubMarker = "1"; this.wrap.appendChild(this.content); this._pos = o.position || null; this.map = o.map || null; }
    set map(m) { if (this._map) { this._map.markers = this._map.markers.filter((x) => x !== this); this.wrap.remove(); } this._map = m; if (m) { (m.markers ||= []).push(this); m.layer.appendChild(this.wrap); this._place(); } }
    get map() { return this._map; }
    set position(p) { this._pos = p; this._place(); }
    get position() { return this._pos; }
    set zIndex(z) { this._z = z; if (this.wrap) this.wrap.style.zIndex = String(z); }
    get zIndex() { return this._z; }
    addListener(ev, fn) { return addListener.call(this, ev, fn); }
    _place() { if (!this._map || !this._pos) return; const p = this._map.project(this._pos.lat, this._pos.lng); this.wrap.style.left = p.x + "px"; this.wrap.style.top = p.y + "px"; }
    _dragTo(lat, lng) { this.position = { lat, lng }; fire(this, "dragend", {}); }
  }
  class OverlayView {
    setMap(m) {
      if (this._map) { this._map.overlays = (this._map.overlays || []).filter((o) => o !== this); this.onRemove && this.onRemove(); }
      this._map = m;
      if (m) { (m.overlays ||= []).push(this); this.onAdd && this.onAdd(); this.draw && this.draw(); }
    }
    getMap() { return this._map; }
    getPanes() { return { overlayLayer: this._map.layer, overlayMouseTarget: this._map.layer }; }
    getProjection() { const m = this._map; return { fromLatLngToDivPixel: (ll) => m.project(ll.lat(), ll.lng()) }; }
  }
  class InfoWindow {
    constructor() { this.el = document.createElement("div"); this.el.setAttribute("role", "dialog"); this.el.dataset.stubInfo = "1"; this.el.style.cssText = "position:absolute;left:8px;top:48px;background:#fff;padding:6px 8px;border-radius:6px;z-index:2000"; }
    setContent(c) { this.el.replaceChildren(c); }
    open({ map }) { map.layer.appendChild(this.el); }
    close() { this.el.remove(); }
  }
  class Place {
    constructor({ id }) { this.id = id; }
    async fetchFields() { const p = PLACES.find((x) => x.id === this.id); if (!p) throw new Error("not found"); this.location = new LatLng(p.lat, p.lng); this.displayName = p.name; this.formattedAddress = "Stub address"; }
  }
  class PlaceAutocompleteElement extends HTMLElement {
    constructor(opts = {}) {
      super();
      window.__placesOptions = opts;
      this.input = document.createElement("input");
      this.input.className = "input";
      this.input.placeholder = "Search places (stub)";
      this.list = document.createElement("ul");
      this.append(this.input, this.list);
      this.input.addEventListener("input", () => {
        const q = this.input.value.toLowerCase();
        this.list.replaceChildren(...PLACES.filter((p) => q && p.name.toLowerCase().includes(q)).map((p) => {
          const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button"; b.textContent = p.name; b.setAttribute("role", "option");
          b.onclick = () => { const ev = new Event("gmp-select"); ev.placePrediction = { toPlace: () => new Place({ id: p.id }) }; this.dispatchEvent(ev); this.list.replaceChildren(); };
          li.appendChild(b); return li;
        }));
      });
    }
  }
  if (!customElements.get("gmp-place-autocomplete")) customElements.define("gmp-place-autocomplete", PlaceAutocompleteElement);

  const libs = {
    maps: { Map, InfoWindow, LatLng, LatLngBounds, OverlayView },
    marker: { AdvancedMarkerElement },
    places: { PlaceAutocompleteElement, Place },
    core: { LatLng, LatLngBounds },
  };
  google.maps.LatLngBounds = LatLngBounds;
  google.maps.LatLng = LatLng;
  google.maps.OverlayView = OverlayView;
  google.maps.marker = libs.marker;
  google.maps.places = libs.places;
  google.maps.importLibrary = async (name) => libs[name];
  if (params.get("key") === "reject-me" && window.gm_authFailure) setTimeout(() => window.gm_authFailure(), 10);
  setTimeout(() => google.maps.__ib__ && google.maps.__ib__(), 0);
})();
