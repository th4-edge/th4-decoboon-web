# 生产发布边界（重建版）

> 状态：已于 2026-10-10 完成生产切换。

## 事实

| 项 | 值 |
| --- | --- |
| 当前线上 Web 源码 | `th4-decoboon-web`（重建版）@ `dev` `677c617` |
| 当前生产 release | `/opt/decoboon-web/releases/20261013-193626`（2026-10-13 19:36 发布） |
| 上一版本/回滚目标 | `/opt/decoboon-web/releases/20261013-184752` |
| 旧归档源码 | `../th4-decoboon-web-v1v2-archive`（仅保留历史与回滚参考） |
| 生产发布脚本 | 本仓库 `scripts/deploy-web.sh`（目标 `/opt/decoboon-web`） |
| 唯一生产入口 | `https://decoboon.joytsing.com/`（全部 7 个角色共用同一构建；`/v3/` 已于 2026-10-12 退役为 301 → `/`） |

## 规则

1. 本仓库 `dev/test/prod` 为当前线上 Web 的发布分支，发布成功后三者保持同一提交。
2. 生产发布必须使用 `scripts/deploy-web.sh`，脚本保留上一版 hashed 资源，切换 `current`，执行 nginx 与 HTTPS 冒烟；失败自动回滚。
3. Web 发布必须与对应后端 release 绑定；本次 Web `20261013-193626` 对应后端 `20261013-081916`（后端本次未重建）。
4. 回滚 Web 使用：
   `ssh root@120.55.15.159 "ln -sfn /opt/decoboon-web/releases/20261013-184752 /opt/decoboon-web/current && nginx -t && systemctl reload nginx"`。
5. 后续功能变更仍按 `AGENTS.md`、业务裁决和验收流程执行，不得用“已上线”替代业务验收结论。
6. **禁止再开第二 Web 入口**：`/v3/`（2026-10-06 的 Designer 测试入口）已于 2026-10-12 退役并 301 到 `/`，
   原目录移入 `/opt/backups/retired/decoboon-web-v3-retired-20261012`。任何角色（含设计师）登录后都必须落在同一生产构建，
   不得通过旧入口、旧书签或按角色分流的第二入口看到历史版本；如需临时测试入口，必须先裁决并登记退出时间。

