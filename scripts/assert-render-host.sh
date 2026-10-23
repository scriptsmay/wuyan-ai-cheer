#!/usr/bin/env bash
# 构建产物断言：render.html 必须被构建，且产物 JS 含 __wuyanRender。
set -euo pipefail
test -f dist/render.html || { echo "FAIL: dist/render.html 缺失"; exit 1; }
grep -rq "__wuyanRender" dist/assets/ || { echo "FAIL: 产物无 __wuyanRender"; exit 1; }
echo "PASS: render host 构建产物就绪"
