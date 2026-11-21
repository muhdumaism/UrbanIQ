"""Pure helpers: class-map verification and detection formatting (no torch import, unit-testable)."""
from __future__ import annotations

import hashlib
import json
import os
from typing import Any, Iterable, Mapping

# Verified against the AI Civic Guardian checkpoint (sha256 11a5db9c…75ea81, names
# {0: pothole, 1: cracks, 2: open_manhole, 3: fallen_tree, 4: garbage, 5: streetlight, 6: water_leak}).
# "cracks" and "open_manhole" are intentionally unmapped; they are still returned (mapped=null).
DEFAULT_CLASS_MAP: dict[str, str] = {
    "pothole": "pothole",
    "garbage": "garbage",
    "water_leak": "water_leak",
    "fallen_tree": "fallen_tree",
    "streetlight": "broken_streetlight",
}
ISSUE_TYPES = {"broken_streetlight", "water_leak", "fallen_tree", "garbage", "pothole"}


class ClassMapError(ValueError):
    pass


def load_class_map() -> dict[str, str]:
    raw = os.environ.get("CLASS_MAP_JSON")
    cmap = json.loads(raw) if raw else dict(DEFAULT_CLASS_MAP)
    bad = {v for v in cmap.values() if v not in ISSUE_TYPES}
    if bad:
        raise ClassMapError(f"CLASS_MAP_JSON maps to unsupported issue types: {sorted(bad)}")
    return cmap


def verify_class_map(model_names: Mapping[int, str] | Iterable[str], class_map: Mapping[str, str]) -> None:
    """Refuse to serve if the checkpoint does not contain every class the map relies on."""
    names = set(model_names.values()) if isinstance(model_names, Mapping) else set(model_names)
    missing = sorted(k for k in class_map if k not in names)
    if missing:
        raise ClassMapError(f"Checkpoint is missing mapped classes {missing}; model has {sorted(names)}")


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def format_detections(raw: Iterable[tuple[str, float, tuple[float, float, float, float]]], class_map: Mapping[str, str], limit: int = 50) -> list[dict[str, Any]]:
    out = []
    for label, conf, (x1, y1, x2, y2) in raw:
        out.append(
            {
                "label": label,
                "mapped": class_map.get(label),
                "confidence": round(float(conf), 4),
                "box": {"x1": round(float(x1), 1), "y1": round(float(y1), 1), "x2": round(float(x2), 1), "y2": round(float(y2), 1)},
            }
        )
    out.sort(key=lambda d: d["confidence"], reverse=True)
    return out[:limit]
