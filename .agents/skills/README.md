# 项目智能体

> 状态：待确认（2026-10-06 建立，依据 `docs/standards/`）

本工程采用**按公理切分**的 3 个智能体，而不是按角色流程切分：

| 智能体 | 守住的公理 | 职责 |
| --- | --- | --- |
| `decoboon-web-frame` | A3 / A4 | 页面该不该做、做成哪类原型、为电脑端做交互提升；守"禁止菜单堆砌与 CRUD" |
| `decoboon-web-parity` | A1 / A2 | 业务逻辑、动作可达性、状态口径、权限与 Provider 是否与 App 一致；守"不新开 API" |
| `decoboon-web-acceptance` | 全部 | 真实浏览器三档验收、权限负向、状态完整、金额口径、反模式排查 |

## 共同规则

1. 业务事实一律回到全局 `zhuangdeqing-business`，本工程不建第二套业务口径。
2. 设计与实现依据 `docs/standards/WEB-建设核心思路.md` 与 `docs/standards/WEB-开发规范.md`。
3. 未过门禁不得表述为「页面已完成」。

## 已停用的旧智能体

2026-10-06 停用的 5 个角色型智能体（product / ui / arch / acceptance / reviewer）见
`_停用/20261006/agents/`，仅作参考，不再生效。
