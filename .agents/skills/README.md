# Web 项目智能体

> 状态：生效（2026-11-02）

Web 不再维护独立重复智能体：

| 用途 | 唯一入口 |
| --- | --- |
| Web UI 设计与视觉门禁 | 当前仓库 `src/AGENTS.md` + `docs/standards/**` |
| 独立验收 | 后端 `docs/testing/**` 与 `docs/testing/scripts/*` |
| App/Web 同源核验 | 后端根 `AGENTS.md` 的“一后端多客户端同源”和 Web 标准 |

## 共同规则

1. 业务事实一律回到全局 `zhuangdeqing-business`，本工程不建第二套业务口径。
2. 设计与实现依据 `docs/standards/WEB-建设核心思路.md` 与 `docs/standards/WEB-开发规范.md`。
3. 未过门禁不得表述为「页面已完成」。

## 已归档

2026-10-06 停用的 5 个角色型智能体见 `_系统/归档/20261102/停用目录/20261006/agents/`。

`decoboon-web-frame`、`decoboon-web-parity`、`decoboon-web-acceptance` 已归档到
`_系统/归档/20261102/skills/`，不再作为活跃 Skill。

## 2026-11-02 变更

- 归档无实际读取证据的 `decoboon-web-parity` 和 `decoboon-web-acceptance`。
- 归档已禁用的 `decoboon-web-frame` 与全部 `_停用/` 历史目录。
- `zhuangdeqing-ui-craft` 已按用户要求从活跃 Skill 删除并归档，不再作为 Web UI 执行入口。
