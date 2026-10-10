# 生产发布边界（重建版）

> 状态：已于 2026-10-10 完成生产切换。

## 事实

| 项 | 值 |
| --- | --- |
| 当前线上 Web 源码 | `th4-decoboon-web`（重建版） |
| 当前生产 release | `/opt/decoboon-web/releases/20261010-161758` |
| 上一版本/回滚目标 | `/opt/decoboon-web/releases/20261007-010750` |
| 旧归档源码 | `../th4-decoboon-web-v1v2-archive`（仅保留历史与回滚参考） |
| 生产发布脚本 | 本仓库 `scripts/deploy-web.sh`（目标 `/opt/decoboon-web`） |

## 规则

1. 本仓库 `dev/test/prod` 为当前线上 Web 的发布分支，发布成功后三者保持同一提交。
2. 生产发布必须使用 `scripts/deploy-web.sh`，脚本保留上一版 hashed 资源，切换 `current`，执行 nginx 与 HTTPS 冒烟；失败自动回滚。
3. Web 发布必须与对应后端 release 绑定；本次 Web `20261010-161758` 对应后端 `20261010-161556`。
4. 回滚 Web 使用：
   `ssh root@120.55.15.159 "ln -sfn /opt/decoboon-web/releases/20261007-010750 /opt/decoboon-web/current && nginx -t && systemctl reload nginx"`。
5. 后续功能变更仍按 `AGENTS.md`、业务裁决和验收流程执行，不得用“已上线”替代业务验收结论。
