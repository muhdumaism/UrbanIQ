"use client";
/**
 * Severity-weighted heatmap drawn on a canvas OverlayView.
 * (Google's visualization.HeatmapLayer was deprecated in 2025 and removed in 2026.)
 */
export type HeatPoint = { lat: number; lng: number; weight: number };

export type Heatmap = { setPoints(p: HeatPoint[]): void; setVisible(v: boolean): void; remove(): void };

let palette: Uint8ClampedArray | null = null;
function getPalette() {
  if (palette) return palette;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, "rgba(127,180,255,0)");
  grad.addColorStop(0.25, "#7fb4ff");
  grad.addColorStop(0.5, "#f5d04c");
  grad.addColorStop(0.75, "#ff9a3c");
  grad.addColorStop(1.0, "#ff4d4a");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 1);
  palette = g.getImageData(0, 0, 256, 1).data;
  return palette;
}

export function createHeatmap(map: google.maps.Map): Heatmap {
  class HeatOverlay extends google.maps.OverlayView {
    canvas = document.createElement("canvas");
    points: HeatPoint[] = [];
    visible = true;
    onAdd() {
      this.canvas.style.cssText = "position:absolute;pointer-events:none;opacity:.85";
      this.canvas.setAttribute("aria-hidden", "true");
      this.canvas.dataset.heatmap = "1";
      this.getPanes()?.overlayLayer.appendChild(this.canvas);
    }
    onRemove() {
      this.canvas.remove();
    }
    draw() {
      const proj = this.getProjection();
      const bounds = map.getBounds();
      if (!proj || !bounds) return;
      const ne = proj.fromLatLngToDivPixel(bounds.getNorthEast());
      const sw = proj.fromLatLngToDivPixel(bounds.getSouthWest());
      if (!ne || !sw) return;
      const left = sw.x;
      const top = ne.y;
      const w = Math.max(1, Math.min(4096, Math.round(ne.x - sw.x)));
      const h = Math.max(1, Math.min(4096, Math.round(sw.y - ne.y)));
      Object.assign(this.canvas.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`, display: this.visible ? "block" : "none" });
      this.canvas.width = w;
      this.canvas.height = h;
      const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx || !this.visible || !this.points.length) return;
      const zoom = map.getZoom() ?? 12;
      const r = Math.max(18, Math.min(70, 14 + (zoom - 5) * 5));
      for (const p of this.points) {
        const px = proj.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng));
        if (!px) continue;
        const x = px.x - left;
        const y = px.y - top;
        if (x < -r || y < -r || x > w + r || y > h + r) continue;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${Math.min(1, 0.25 * p.weight)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const pal = getPalette();
      for (let i = 3; i < d.length; i += 4) {
        const a = d[i];
        if (!a) continue;
        const o = a * 4;
        d[i - 3] = pal[o];
        d[i - 2] = pal[o + 1];
        d[i - 1] = pal[o + 2];
        d[i] = Math.min(220, a * 1.4);
      }
      ctx.putImageData(img, 0, 0);
    }
  }
  const o = new HeatOverlay();
  o.setMap(map);
  const idle = map.addListener("idle", () => o.draw());
  return {
    setPoints(p) {
      o.points = p;
      o.draw();
    },
    setVisible(v) {
      o.visible = v;
      o.draw();
    },
    remove() {
      idle.remove();
      o.setMap(null);
    },
  };
}

export const SEVERITY_WEIGHT = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
