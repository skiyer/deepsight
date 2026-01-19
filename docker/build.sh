#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔨 步骤 1/3: 构建 WebView UI..."
cd "$PROJECT_ROOT/extension/webview-ui"
pnpm install
pnpm build

echo "📦 步骤 2/3: 编译并打包扩展..."
cd "$PROJECT_ROOT/extension"
pnpm install
pnpm compile
pnpm package

echo "📋 步骤 3/3: 准备 VSIX 文件..."
LATEST_VSIX=$(ls -t deepsight-*.vsix 2>/dev/null | head -1)
if [ -z "$LATEST_VSIX" ]; then
  echo "❌ 未找到 vsix 文件"
  exit 1
fi
cp "$LATEST_VSIX" "$SCRIPT_DIR/deepsight.vsix"
echo "✅ 已复制 $LATEST_VSIX -> $SCRIPT_DIR/deepsight.vsix"

echo "🐳 构建 Docker 镜像..."
cd "$PROJECT_ROOT"
docker build --platform linux/amd64 -t deepsight-codeserver -f docker/Dockerfile .

echo "🏷️ 打标签..."
docker tag deepsight-codeserver lubcorzexc/deepsight-codeserver:latest

echo "✅ 构建完成!"
