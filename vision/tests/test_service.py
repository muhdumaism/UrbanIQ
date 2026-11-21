import io
import importlib
import os

import pytest
from PIL import Image


class FakeBox:
    def __init__(self, cls, conf, xyxy):
        self.cls = [cls]
        self.conf = [conf]
        self.xyxy = [FakeTensor(xyxy)]


class FakeTensor(list):
    def tolist(self):
        return list(self)


class FakeResult:
    def __init__(self, boxes):
        self.boxes = boxes


NAMES = {0: "pothole", 1: "cracks", 2: "open_manhole", 3: "fallen_tree", 4: "garbage", 5: "streetlight", 6: "water_leak"}


class FakeModel:
    names = NAMES

    def __init__(self, path):
        self.path = path

    def predict(self, img, **kw):
        assert kw["device"] == "cpu"
        return [FakeResult([FakeBox(5, 0.91, [10, 20, 110, 220]), FakeBox(1, 0.4, [0, 0, 5, 5])])]


@pytest.fixture()
def service(tmp_path, monkeypatch):
    weights = tmp_path / "civic_guardian.pt"
    weights.write_bytes(b"fake-weights")
    monkeypatch.setenv("MODEL_PATH", str(weights))
    monkeypatch.setenv("VISION_TOKEN", "secret-token")
    monkeypatch.setenv("VISION_SKIP_AUTOLOAD", "1")
    monkeypatch.delenv("EXPECTED_SHA256", raising=False)
    import civic_vision.app as app_mod

    app_mod = importlib.reload(app_mod)
    from fastapi.testclient import TestClient

    return app_mod, TestClient(app_mod.app)


def jpeg():
    b = io.BytesIO()
    Image.new("RGB", (320, 240), "gray").save(b, "JPEG")
    return b.getvalue()


AUTH = {"Authorization": "Bearer secret-token"}


def test_maps_streetlight_to_broken_streetlight_and_keeps_unmapped(service):
    mod, client = service
    mod.load_model(factory=FakeModel)
    r = client.post("/v1/detect", files={"image": ("p.jpg", jpeg(), "image/jpeg")}, headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["image"] == {"width": 320, "height": 240}
    assert body["detections"][0] == {"label": "streetlight", "mapped": "broken_streetlight", "confidence": 0.91, "box": {"x1": 10.0, "y1": 20.0, "x2": 110.0, "y2": 220.0}}
    assert body["detections"][1]["label"] == "cracks" and body["detections"][1]["mapped"] is None


def test_requires_token(service):
    mod, client = service
    mod.load_model(factory=FakeModel)
    assert client.post("/v1/detect", files={"image": ("p.jpg", jpeg(), "image/jpeg")}).status_code == 401
    assert client.post("/v1/detect", files={"image": ("p.jpg", jpeg(), "image/jpeg")}, headers={"Authorization": "Bearer nope"}).status_code == 401


def test_missing_model_returns_503(service, monkeypatch):
    mod, client = service
    monkeypatch.setattr(mod, "MODEL_PATH", "/nonexistent/civic_guardian.pt")
    mod.load_model(factory=FakeModel)
    assert mod.state.status == "missing"
    assert client.post("/v1/detect", files={"image": ("p.jpg", jpeg(), "image/jpeg")}, headers=AUTH).status_code == 503
    assert client.get("/healthz").json() == {"ok": True, "model": "missing"}


def test_checksum_pin_refuses_other_weights(service, monkeypatch):
    mod, _ = service
    monkeypatch.setattr(mod, "EXPECTED_SHA256", "0" * 64)
    mod.load_model(factory=FakeModel)
    assert mod.state.status == "checksum_mismatch"


def test_class_map_mismatch_refuses_to_serve(service):
    mod, _ = service

    class Other(FakeModel):
        names = {0: "cat", 1: "dog"}

    mod.load_model(factory=Other)
    assert mod.state.status == "class_map_mismatch"


def test_rejects_non_images(service):
    mod, client = service
    mod.load_model(factory=FakeModel)
    r = client.post("/v1/detect", files={"image": ("x.jpg", b"not an image", "image/jpeg")}, headers=AUTH)
    assert r.status_code == 415
