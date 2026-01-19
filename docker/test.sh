#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 确保工作目录存在且为空
mkdir -p /tmp/workspace

# 停止并删除已存在的容器
docker rm -f code-server 2>/dev/null || true

# 运行 code-server 容器
docker run --env-file "$PROJECT_ROOT/server/.env" --platform linux/amd64 -d \
  --name code-server \
  -p 8443:8443 \
  -e TZ=Asia/Shanghai \
  -v /tmp/workspace:/config/workspace \
  deepsight-codeserver

echo "✅ code-server 已启动，访问 https://localhost:8443"
