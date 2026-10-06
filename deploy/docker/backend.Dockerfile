FROM python:3.12.14-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
COPY deploy/requirements.txt /app/deploy/requirements.txt
RUN pip install --no-cache-dir -r /app/deploy/requirements.txt \
    && useradd --uid 10001 --create-home mu56
COPY backend /app/backend
COPY frontend/src/lib/lead-consent.json /app/frontend/src/lib/lead-consent.json
COPY deploy/gunicorn.conf.py /app/deploy/gunicorn.conf.py
USER 10001:10001
WORKDIR /app/backend
# Container shares the private application gateway network namespace;
# Gunicorn stays on loopback, preserving the trusted single-proxy setup.
CMD ["gunicorn", "--config", "/app/deploy/gunicorn.conf.py", "--workers", "1", "config.wsgi:application"]
