FROM node:24.18.0-bookworm-slim
RUN npm install -g pnpm@11.19.0
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
