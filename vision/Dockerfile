# UrbanIQ private vision service — CPU only. Model weights are NOT included: mount them at /models.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    MODEL_PATH=/models/civic_guardian.pt YOLO_CONFIG_DIR=/tmp/ultralytics

RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.14.0 torchvision==0.29.0
COPY requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt && pip uninstall -y opencv-python && pip install opencv-python-headless==4.11.0.86

WORKDIR /app
COPY civic_vision /app/civic_vision
RUN useradd --system --uid 10001 vision && mkdir -p /models /tmp/ultralytics && chown vision /tmp/ultralytics
USER vision

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/healthz',timeout=4)"
CMD ["uvicorn", "civic_vision.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
