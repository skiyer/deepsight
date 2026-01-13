FROM linuxserver/code-server:latest

# 1. 创建存放 VSIX 文件的目录
RUN mkdir -p /bg-extensions

# 2. 安装需要的插件 (.vsix)

# 下载 C/C++ 插件
RUN curl -L -o /bg-extensions/cpptools-linux.vsix \
    https://github.com/microsoft/vscode-cpptools/releases/latest/download/cpptools-linux-x64.vsix

# 3. 将初始化脚本复制到 LSIO 的启动脚本目录
COPY 30-install-extensions /custom-cont-init.d/30-install-extensions

# 4. 赋予脚本执行权限
RUN chmod +x /custom-cont-init.d/30-install-extensions

# 5. 安装deepsight
COPY deepsight.vsix /bg-extensions/deepsight.vsix
