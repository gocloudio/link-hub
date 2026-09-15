FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS web
WORKDIR /src/web
COPY web/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY web/ ./
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.25-bookworm AS backend
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags='-s -w' -o /server ./cmd/server

FROM debian:bookworm-slim
WORKDIR /app
ARG TAG=dev
LABEL org.opencontainers.image.title="link-hub" \
      org.opencontainers.image.version=$TAG
COPY --from=backend /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=backend /server /app/server
COPY --from=web /src/web/dist /app/web
ENV WEB_DIR=/app/web HTTP_ADDR=:8080
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s CMD ["/app/server", "healthcheck"]
ENTRYPOINT ["/app/server"]
