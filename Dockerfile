# 国内拉取基础镜像慢时：docker build --build-arg IMAGE_PREFIX=docker.m.daocloud.io/library/ .

ARG IMAGE_PREFIX=
FROM ${IMAGE_PREFIX}node:20-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
ARG NPM_REGISTRY=
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi
RUN npm install
COPY web/ ./
RUN npm run build

# Build backend
FROM ${IMAGE_PREFIX}golang:1.22-alpine AS builder
WORKDIR /app
ENV GOPROXY=https://goproxy.cn,direct
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /minibill ./cmd/server \
	&& CGO_ENABLED=0 go build -o /create-user ./cmd/create-user \
	&& CGO_ENABLED=0 go build -o /reset-password ./cmd/reset-password

# Runtime
FROM ${IMAGE_PREFIX}alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
ENV TZ=Asia/Shanghai
WORKDIR /app
COPY --from=builder /minibill /app/minibill
COPY --from=builder /create-user /app/create-user
COPY --from=builder /reset-password /app/reset-password
COPY --from=web /app/web/out /app/web/out
COPY migrations /app/migrations
ENV STATIC_DIR=/app/web/out
ENV MIGRATIONS_SYSTEM=/app/migrations/system
ENV MIGRATIONS_LEDGER=/app/migrations/ledger
ENV DATA_DIR=/data
EXPOSE 8080
CMD ["/app/minibill"]
