# Isolated acceptance image, not the public deployment architecture.
FROM node:24.18.0-bookworm-slim AS node
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends python3-venv nginx openssl curl ca-certificates \
    && curl --fail --retry 3 --max-time 120 https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/keyrings/postgresql.asc \
    && echo 'deb [signed-by=/usr/share/keyrings/postgresql.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main' > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends postgresql-client-18 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && npm install --global pnpm@11.19.0 \
    && useradd --create-home --uid 10001 mu56 && usermod -a -G mu56 www-data
WORKDIR /app
COPY backend /app/backend
COPY deploy /app/deploy
RUN python3 -m venv /app/.venv && /app/.venv/bin/pip install --no-cache-dir -r deploy/requirements.txt
COPY frontend /app/frontend
RUN pnpm --dir frontend install --frozen-lockfile && chown -R mu56:mu56 /app/frontend
COPY scripts/check_linux_stack.py /app/scripts/check_linux_stack.py
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
CMD ["/app/.venv/bin/python", "/app/scripts/check_linux_stack.py"]
