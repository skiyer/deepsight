#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔨 步骤 1/5: 构建 WebView UI..."
cd "$PROJECT_ROOT/extension/webview-ui"
pnpm install
pnpm build

echo "📦 步骤 2/5: 编译并打包扩展..."
cd "$PROJECT_ROOT/extension"
pnpm install
pnpm compile
pnpm package

echo "🖥️ 步骤 3/5: 编译 Server..."
cd "$PROJECT_ROOT/server"
pnpm install
pnpm build

echo "⌨️ 步骤 4/5: 编译 CLI..."
cd "$PROJECT_ROOT/cli"
pnpm install
pnpm build

echo "📋 步骤 5/5: 准备 VSIX 文件..."
cd "$PROJECT_ROOT/extension"
LATEST_VSIX=$(ls -t deepsight-*.vsix 2>/dev/null | head -1)
if [ -z "$LATEST_VSIX" ]; then
  echo "❌ 未找到 vsix 文件"
  exit 1
fi
cp "$LATEST_VSIX" "$SCRIPT_DIR/deepsight.vsix"
echo "✅ 已复制 $LATEST_VSIX -> $SCRIPT_DIR/deepsight.vsix"

# 生成日期版本号 (格式: YYYYMMDD)
DATE_TAG=$(date +%Y%m%d)

echo "🐳 构建 deepsight-codeserver 镜像..."
cd "$PROJECT_ROOT"

docker build --platform linux/amd64 -t deepsight-codeserver -f docker/Dockerfile .

echo "🏷️ 打标签 (codeserver)..."
docker tag deepsight-codeserver lubcorzexc/deepsight-codeserver:latest
docker tag deepsight-codeserver lubcorzexc/deepsight-codeserver:$DATE_TAG

echo "🐳 构建 deepsight-cli 镜像..."
docker build --platform linux/amd64 -t deepsight-cli -f docker/Dockerfile.cli .

echo "🏷️ 打标签 (cli)..."
docker tag deepsight-cli lubcorzexc/deepsight-cli:latest
docker tag deepsight-cli lubcorzexc/deepsight-cli:$DATE_TAG

echo "✅ 构建完成!"
echo "📌 deepsight-codeserver 镜像标签:"
echo "   - lubcorzexc/deepsight-codeserver:latest"
echo "   - lubcorzexc/deepsight-codeserver:$DATE_TAG"
echo "📌 deepsight-cli 镜像标签:"
echo "   - lubcorzexc/deepsight-cli:latest"
echo "   - lubcorzexc/deepsight-cli:$DATE_TAG"

# 推送镜像 (可通过 --push 参数启用)
if [[ "$1" == "--push" ]]; then
  echo "🚀 推送镜像到 Docker Hub..."
  docker push lubcorzexc/deepsight-codeserver:latest
  docker push lubcorzexc/deepsight-codeserver:$DATE_TAG
  docker push lubcorzexc/deepsight-cli:latest
  docker push lubcorzexc/deepsight-cli:$DATE_TAG
  echo "✅ 推送完成!"
else
  echo "💡 如需推送镜像，请运行: $0 --push"
fi
