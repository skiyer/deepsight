# syntax=docker/dockerfile:1

FROM node:24.13.0-bookworm-slim AS node_source

FROM linuxserver/code-server:latest

# 设置环境变量
ENV NODE_ENV=production

# --- 1. Node.js 资源复制 ---
COPY --from=node_source /usr/local/bin /usr/local/bin
COPY --from=node_source /usr/local/lib /usr/local/lib

# --- 2. 系统依赖与 pnpm 激活 ---
RUN mkdir -p /bg-extensions /custom-services.d \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates clangd curl \
    && node --version && npm --version \
    && npm install -g pnpm \
    && npm cache clean --force \
    && pnpm --version \
    # 下载扩展
    && curl -fsSL -o /bg-extensions/clangd-0.2.0.vsix \
       https://github.com/clangd/vscode-clangd/releases/download/0.2.0/vscode-clangd-0.2.0.vsix \
    # 系统清理
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# --- 3. 扩展配置 ---
COPY --chmod=755 docker/30-install-extensions /custom-cont-init.d/30-install-extensions
COPY docker/deepsight.vsix /bg-extensions/deepsight.vsix

# --- 4. 应用依赖安装 ---
WORKDIR /bg

COPY server/package.json server/pnpm-lock.yaml* ./

# 安装本地依赖 -> 统一清理 Store
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --prod --frozen-lockfile; \
    else \
      pnpm install --prod; \
    fi \
    && pnpm store prune

# --- 5. 复制代码产物 ---
COPY server/dist ./dist

# --- 6. S6 服务配置 ---
RUN printf '#!/usr/bin/with-contenv bash\n\nexec s6-setuidgid abc node /bg/dist/index.js\n' \
    > /custom-services.d/svc-deepsight-server \
    && chmod +x /custom-services.d/svc-deepsight-server

# --- 7. 预装 Claude Code（二进制放到 /usr/local/bin，避免被 /config 挂载覆盖） ---
RUN set -eux; \
    GCS_BUCKET="https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases"; \
    version="$(curl -fsSL "$GCS_BUCKET/latest")"; \
    checksum="$(curl -fsSL "$GCS_BUCKET/$version/manifest.json" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const m=JSON.parse(d);const p=m.platforms?.["linux-x64"]?.checksum||"";process.stdout.write(p);});')"; \
    test -n "$checksum"; \
    curl -fsSL -o /usr/local/bin/claude "$GCS_BUCKET/$version/linux-x64/claude"; \
    echo "$checksum  /usr/local/bin/claude" | sha256sum -c -; \
    chmod +x /usr/local/bin/claude; \
    /usr/local/bin/claude --version
