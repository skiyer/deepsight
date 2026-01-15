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
    && apt-get install -y --no-install-recommends clangd curl \
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
