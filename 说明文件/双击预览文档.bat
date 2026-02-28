@echo off
chcp 65001 >nul
echo ===================================================
echo     正在启动 洁净室说明文档 本地预览服务
echo ===================================================
echo.
echo 注意：Docsify 需要一个本地 http 服务器才能读取 .md 文件。
echo 部署到 Netlify 等线上服务器后即可直接访问。
echo.

:: 检查 Python 环境
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] 检测到 Python 环境。
    echo 正在为您打开浏览器...
    start http://localhost:8999
    echo ---------------------------------------------------
    echo 服务已启动！请保持此窗口打开。如需停止，请直接关闭本窗口。
    echo ---------------------------------------------------
    python -m http.server 8999
    exit
)

:: 检查 Node 环境
where npx >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] 检测到 Node.js 环境。
    echo 正在为您打开浏览器...
    start http://localhost:8999
    echo ---------------------------------------------------
    echo 服务已启动！请保持此窗口打开。如需停止，请直接关闭本窗口。
    echo ---------------------------------------------------
    npx serve . -p 8999
    exit
)

echo [错误] 未检测到 Python 或 Node.js 环境！
echo 请在 VS Code 里右键 index.html，选择 "Open with Live Server" 来预览。
pause
