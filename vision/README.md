# UrbanIQ vision service (private, CPU)

FastAPI wrapper around the **AI Civic Guardian** YOLO checkpoint
([kainatmoin/AI-Civic-Guardian](https://github.com/kainatmoin/AI-Civic-Guardian), `backend/models/civic_guardian.pt`).
UrbanIQ calls it from the background triage job. Its output is **advisory evidence for officers only**:
it never sets severity, routing or status. When it is missing, offline or inconclusive, triage continues
with text + location.

> **Status: the weights are NOT bundled, and they must not be deployed until reuse is cleared (see below).**
> The service runs without them and reports `model: "missing"`; UrbanIQ then records the photo
> analysis as *unavailable*.

## Checkpoint verification (done 2026‑11‑21, static inspection only)

The `.pt` file was inspected as a zip/pickle **without unpickling it**, because loading it with torch runs code.

| Item | Finding |
| --- | --- |
| Source commit | `7c8828fa1d18e455f4db50c78a9acf327fd39a54` (2026‑09‑06) |
| File | `backend/models/civic_guardian.pt`, 5,451,802 bytes |
| sha256 | `11a5db9c6ad7252bcd336d6c7d84630f504683e7429f9e71d6bc7cc8af75ea81` |
| Architecture | Ultralytics YOLO11n detection (`yolo11n.yaml`), Ultralytics 8.4.139, trained 2026‑09‑05 |
| Pickle globals | Only `torch.*`, `ultralytics.nn.*`, `collections.OrderedDict`, `builtins.set`; nothing unexpected |
| Class map | `0 pothole · 1 cracks · 2 open_manhole · 3 fallen_tree · 4 garbage · 5 streetlight · 6 water_leak` |
| Training data | Unknown (`data.yaml` path is local to the author's machine); README lists the classes but no dataset or metrics |

**UrbanIQ mapping** (`civic_vision/mapping.py`, overridable with `CLASS_MAP_JSON`):

| Checkpoint label | UrbanIQ issue type | UrbanIQ subtype |
| --- | --- | --- |
| `pothole` | `pothole` | Roads › Pothole |
| `garbage` | `garbage` | Waste › Garbage / litter |
| `water_leak` | `water_leak` | Water Supply › Water supply leak |
| `fallen_tree` | `fallen_tree` | Trees › Fallen tree |
| `streetlight` | `broken_streetlight` | Streetlighting › Streetlight out |
| `cracks`, `open_manhole` | unmapped (returned with `mapped: null`) | — |

`streetlight` is named generically in the checkpoint. The repo README calls the class *Broken Streetlight*,
but that is unconfirmed: check on held-out photos that it doesn't fire on working lights before
relying on the mapping.

### Reuse permission — **not cleared (blocker for deployment)**

* The repository has **no LICENSE file**. By default, no right to copy, modify or redistribute the weights is granted.
* The checkpoint metadata declares **Ultralytics AGPL‑3.0**. Serving an AGPL model over a network brings AGPL obligations (or needs an Ultralytics Enterprise licence).
* Before bundling or deploying: get written permission from the repository owner, choose AGPL compliance or a commercial
  Ultralytics licence, and confirm the training data's terms.

## API

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/healthz` | none | `{ok, model}` where model ∈ loading, ready, missing, checksum_mismatch, class_map_mismatch, error |
| GET | `/v1/model` | Bearer | sha256, class names, class map |
| POST | `/v1/detect` | Bearer | multipart `image` (JPEG/PNG/WebP ≤10 MB) → `{model, image:{width,height}, detections:[{label, mapped, confidence, box:{x1,y1,x2,y2}}]}`; 503 if the model is not ready |

The service refuses to serve when:

* the file's sha256 doesn't match `EXPECTED_SHA256`, or
* the checkpoint lacks a mapped class.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `MODEL_PATH` | `/models/civic_guardian.pt` | Mounted read-only; never baked into the image |
| `EXPECTED_SHA256` | — | Pin the verified checkpoint (recommended) |
| `VISION_TOKEN` | — (required) | Shared secret with the UrbanIQ app |
| `CLASS_MAP_JSON` | see table | e.g. `{"pothole":"pothole",...}` |
| `PREFILTER_CONF` | `0.10` | Raw detector cut-off; the app applies `VISION_MIN_CONFIDENCE` (0.5) for classification |
| `IMGSZ`, `MAX_CONCURRENCY`, `MAX_IMAGE_BYTES` | 640, 1, 10 MB | |

## Run locally

```bash
docker compose --profile vision up -d --build vision
```

Then point the app at it: `VISION_URL=http://127.0.0.1:8001` and set the same `VISION_TOKEN` in both places.
Put the weights in `vision/models/civic_guardian.pt` only after permission is cleared; the folder is git-ignored.

## Deploy on Dokploy (private CPU container)

1. Create an **Application** from this repository with build type **Dockerfile** and build path `vision/`.
2. **Do not add a domain.** Leave the service on the internal Docker network only. Dokploy services in the same project reach it by its
   app name, e.g. `http://urbaniq-vision:8000`.
3. Under **Advanced → Volumes**, add a file or volume mount at `/models`, read-only, containing `civic_guardian.pt` (after clearance).
4. Environment: `VISION_TOKEN`, `EXPECTED_SHA256=11a5db9c…75ea81`, optionally `MAX_CONCURRENCY=1`.
5. Resources: about 1–2 vCPU and 2 GB RAM. YOLO11n on CPU takes roughly 100–400 ms per image.
6. On the UrbanIQ app, set `VISION_URL=http://urbaniq-vision:8000` and the same `VISION_TOKEN`.

## Tests

```bash
python -m venv .venv && .venv/bin/pip install -r requirements-test.txt
.venv/bin/python -m pytest -q
```

The tests use a fake model (no torch, no weights). They cover class mapping, auth, missing model,
checksum pinning, class-map mismatch and non-image rejection.
