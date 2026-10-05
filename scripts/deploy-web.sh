#!/usr/bin/env bash
# 装得清 Web（重建版）· 生产发布守卫
#
# 本工程是 2026-10-06 起的重建版本，尚未与线上功能对齐。
# 线上 Web 目前仍由归档库 th4-decoboon-web-v1v2-archive 的构建产物提供。
# 在重建版通过完整验收并明确切换前，禁止发布到生产。
set -euo pipefail

cat >&2 <<'MSG'
[deploy-web] 拒绝执行：th4-decoboon-web（重建版）尚未完成与线上功能对齐。

- 线上 Web 源码：../th4-decoboon-web-v1v2-archive（V1/V2，冻结）
- 生产发布：在归档库执行 scripts/deploy-web.sh
- 切换条件：重建版达到功能对齐 + G3 渲染验收 + 全角色闭环验收通过，且用户明确授权切换

如确需在非生产环境验证构建产物，请使用 npm run build + npm run preview，不要走本脚本。
MSG
exit 1
