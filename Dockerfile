FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY frontend/ ./
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN pnpm build

FROM golang:1.23-alpine AS backend-builder
WORKDIR /app/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/spacecolonyminer .

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app

COPY --from=backend-builder /out/spacecolonyminer /app/spacecolonyminer
COPY --from=frontend-builder /app/frontend/dist /app/public

ENV PORT=8080
ENV STATIC_DIR=/app/public

EXPOSE 8080
ENTRYPOINT ["/app/spacecolonyminer"]
