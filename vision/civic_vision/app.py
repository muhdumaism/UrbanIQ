"""
UrbanIQ private photo-analysis service (AI Civic Guardian YOLO checkpoint).

Runs on CPU inside a private network. Weights are NOT part of the image: mount them and point
MODEL_PATH at the file. Set EXPECTED_SHA256 to pin the exact checkpoint (loading a .pt file
unpickles it, so only load files you have verified).
"""
from __future__ import annotations

import asyncio
import hmac
import io
import logging
import os
import threading
import time
from typing import Any, Optional

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from .mapping import ClassMapError, format_detections, load_class_map, sha256_file, verify_class_map

log = logging.getLogger("civic_vision")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

MODEL_PATH = os.environ.get("MODEL_PATH", "/models/civic_guardian.pt")
EXPECTED_SHA256 = os.environ.get("EXPECTED_SHA256", "").strip().lower()
TOKEN = os.environ.get("VISION_TOKEN", "")
PREFILTER_CONF = float(os.environ.get("PREFILTER_CONF", "0.10"))
IMGSZ = int(os.environ.get("IMGSZ", "640"))
MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
MAX_CONCURRENCY = int(os.environ.get("MAX_CONCURRENCY", "1"))


class ModelState:
    def __init__(self) -> None:
        self.status = "loading"  # loading | ready | missing | checksum_mismatch | class_map_mismatch | error
        self.detail = ""
        self.model: Any = None
        self.names: dict[int, str] = {}
        self.sha256: Optional[str] = None
        self.class_map = load_class_map()


state = ModelState()
app = FastAPI(title="UrbanIQ vision", docs_url=None, redoc_url=None, openapi_url=None)
_sem = asyncio.Semaphore(MAX_CONCURRENCY)


def load_model(factory=None) -> None:
    """Load and verify the checkpoint. `factory` is injectable for tests (defaults to ultralytics.YOLO)."""
    try:
        if not os.path.isfile(MODEL_PATH):
            state.status, state.detail = "missing", f"No checkpoint at MODEL_PATH ({MODEL_PATH})."
            return
        digest = sha256_file(MODEL_PATH)
        state.sha256 = digest
        if EXPECTED_SHA256 and digest != EXPECTED_SHA256:
            state.status, state.detail = "checksum_mismatch", "Checkpoint sha256 does not match EXPECTED_SHA256; refusing to load."
            return
        if factory is None:
            from ultralytics import YOLO  # heavy import, only when actually serving

            factory = YOLO
        model = factory(MODEL_PATH)
        names = dict(model.names)
        verify_class_map(names, state.class_map)
        state.model, state.names, state.status, state.detail = model, names, "ready", ""
        log.info("model ready sha256=%s classes=%s", digest, names)
    except ClassMapError as e:
        state.status, state.detail = "class_map_mismatch", str(e)
    except Exception as e:  # noqa: BLE001 - surface a safe status instead of crashing
        log.exception("model load failed")
        state.status, state.detail = "error", f"Model failed to load: {type(e).__name__}"


@app.on_event("startup")
def _startup() -> None:
    if os.environ.get("VISION_SKIP_AUTOLOAD") != "1":
        threading.Thread(target=load_model, daemon=True).start()


def _auth(authorization: Optional[str]) -> None:
    if not TOKEN:
        raise HTTPException(503, "VISION_TOKEN is not configured")
    expected = f"Bearer {TOKEN}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(401, "Unauthorized")


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    # Liveness for the container; deliberately minimal and unauthenticated.
    return {"ok": True, "model": state.status}


@app.get("/v1/model")
def model_info(authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    _auth(authorization)
    return {"status": state.status, "detail": state.detail, "sha256": state.sha256, "names": state.names, "class_map": state.class_map}


def _infer(img: Image.Image) -> list[tuple[str, float, tuple[float, float, float, float]]]:
    res = state.model.predict(img, conf=PREFILTER_CONF, imgsz=IMGSZ, device="cpu", verbose=False)[0]
    out = []
    for box in res.boxes:
        cls = int(box.cls[0])
        out.append((state.names.get(cls, str(cls)), float(box.conf[0]), tuple(float(v) for v in box.xyxy[0].tolist())))
    return out


@app.post("/v1/detect")
async def detect(image: UploadFile = File(...), authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    _auth(authorization)
    if state.status != "ready":
        raise HTTPException(503, f"Model not ready: {state.status}")
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large")
    try:
        img = Image.open(io.BytesIO(data))
        if img.format not in {"JPEG", "PNG", "WEBP"}:
            raise HTTPException(415, "Unsupported image type")
        img = img.convert("RGB")
    except UnidentifiedImageError:
        raise HTTPException(415, "Unreadable image")
    started = time.perf_counter()
    async with _sem:
        raw = await asyncio.to_thread(_infer, img)
    return {
        "model": {"name": os.path.basename(MODEL_PATH), "sha256": state.sha256, "framework": "ultralytics-yolo"},
        "image": {"width": img.width, "height": img.height},
        "detections": format_detections(raw, state.class_map),
        "inference_ms": round((time.perf_counter() - started) * 1000, 1),
    }
