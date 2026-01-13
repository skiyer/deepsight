# DeepSight Code-Server 镜像

基于 [linuxserver/code-server](https://docs.linuxserver.io/images/docker-code-server) 构建的 VS Code 开发环境，预装 DeepSight 扩展。

## 预装扩展

- **DeepSight** - AI 代码解释和安全审计工具
- **C/C++ Tools** - Microsoft 官方 C/C++ 开发工具链

## 构建步骤

### 1. 准备 VSIX 文件

构建前需要先将 DeepSight 扩展复制到 `docker/` 目录：

```bash
cd /path/to/deepsight
cp extension/deepsight-*.vsix docker/deepsight.vsix
```

### 2. 构建镜像

```bash
cd /path/to/deepsight
docker build -t deepsight-codeserver -f docker/Dockerfile .
```

构建参数说明：
- `-t deepsight-codeserver` - 镜像名称
- `-f docker/Dockerfile` - Dockerfile 路径
- `.` - 构建上下文为项目根目录（用于访问 VSIX 文件）

## 使用说明

### 基础运行

```bash
docker run -d \
  --name code-server \
  -p 8443:8443 \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=Asia/Shanghai \
  -v /path/to/config:/config \
  deepsight-codeserver
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PUID` | `911` | 运行用户 ID |
| `PGID` | `911` | 运行组 ID |
| `TZ` | `UTC` | 时区（如 `Asia/Shanghai`） |
| `PASSWORD` | 随机 | 登录密码（建议设置） |

### 持久化存储

建议挂载以下目录：

| 目录 | 说明 |
|------|------|
| `/config` | 配置和已安装的扩展 |
| `/config/workspace` | 工作区代码目录 |

### 完整示例

```bash
docker run -d \
  --name code-server \
  --restart unless-stopped \
  -p 8443:8443 \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=Asia/Shanghai \
  -e PASSWORD=your_secure_password \
  -v ~/code-server-config:/config \
  -v ~/projects:/config/workspace \
  deepsight-codeserver
```

访问 `https://localhost:8443`（首次会提示证书警告，选择继续访问）

## DeepSight 使用

1. 启动 DeepSight 后端服务（需独立运行，见项目 README）
2. 在 code-server 中打开代码文件
3. 点击函数/类上方的 `✨ Explain` 或 `🛡️ Audit` 按钮
4. 在右侧侧边栏查看分析结果

## 扩展管理

### 预装扩展机制

容器启动时会自动执行 `/custom-cont-init.d/30-install-extensions` 脚本，将 `/bg-extensions/` 目录下的所有 `.vsix` 文件安装到用户扩展目录 `/config/extensions`。

### 手动安装扩展

```bash
docker exec -it code-server /app/code-server/bin/code-server \
  --install-extension publisher.extension-name \
  --extensions-dir /config/extensions
```

### 查看已安装扩展

```bash
docker exec -it code-server /app/code-server/bin/code-server \
  --list-extensions \
  --extensions-dir /config/extensions
```

## 故障排查

### 构建失败：找不到 deepsight.vsix

确保已将 VSIX 文件复制到 `docker/deepsight.vsix`：

```bash
ls -la docker/deepsight.vsix
```

### 扩展未自动安装

检查容器日志：

```bash
docker logs code-server | grep "Installing extension"
```

### DeepSight 无响应

1. 确认后端服务已启动并监听 `localhost:3000`
2. 在 code-server 中打开开发者工具（F12）查看网络请求
3. 检查 DeepSight Debug 输出通道的日志

### 权限问题

确保挂载的配置目录权限正确：

```bash
chown -R 1000:1000 ~/code-server-config
```

## 项目结构

```
docker/
├── Dockerfile               # 镜像构建文件
├── 30-install-extensions    # 扩展自动安装脚本
└── README.md                # 本文档
```

## 相关链接

- [linuxserver/code-server 文档](https://docs.linuxserver.io/images/docker-code-server)
- [DeepSight 项目 README](../README.md)
- [DeepSight 架构文档](../Architect.md)
