# 停用清单 · 2026-10-06

本目录保存在 2026-10-06 被**停用**的智能体与规范。内容完整保留，可随时恢复或作为重写输入，
但**不再作为本工程的生效约束**。

## 停用原因

用户决定重新构建 Web 端的智能体与规范体系，不用首版重建产物作为约束。

## 停用的智能体（5）

| 智能体 | 原职责 | 原路径 |
| --- | --- | --- |
| `decoboon-web-product` | 产品推演、场景冻结、信息架构、R1–R3 迭代包 | `.agents/skills/decoboon-web-product/` |
| `decoboon-web-ui` | 视觉与交互设计、组件规范、渲染后批判循环 | `.agents/skills/decoboon-web-ui/` |
| `decoboon-web-arch` | 分层架构、路由/状态/请求、性能与守卫 | `.agents/skills/decoboon-web-arch/` |
| `decoboon-web-acceptance` | 三档分辨率渲染验收、全角色沉浸审计 | `.agents/skills/decoboon-web-acceptance/` |
| `decoboon-web-reviewer` | 中小装企视角独立审查 | `.agents/skills/decoboon-web-reviewer/` |

## 停用的规范（9）

| 原路径 | 内容 |
| --- | --- |
| `AGENTS.md` | 重建原则 + 七条工程铁律 + G1→G1.5→G2→G3 门禁 |
| `docs/product/WEB-PRODUCT-CHARTER.md` | 产品宪章 |
| `docs/product/WEB-INFORMATION-ARCHITECTURE.md` | 信息架构 |
| `docs/product/WEB-DESIGN-SYSTEM.md` | 设计系统 |
| `docs/product/WEB-COMPONENT-SPEC.md` | 组件规范 |
| `docs/product/WEB-PAGE-DELIVERY-GATE.md` | 页面交付门禁 |
| `docs/development/WEB-FRONTEND-STANDARD.md` | 前端工程规范 |
| `docs/development/WEB-PROVIDER-CONTRACT.md` | Provider 契约 |
| `docs/acceptance/WEB-ACCEPTANCE-PROTOCOL.md` | 验收协议 |

## 恢复方式

```bash
# 单个恢复
git mv "_停用/20261006/agents/<智能体名>" ".agents/skills/<智能体名>"
git mv "_停用/20261006/docs/product/<文件名>.md" "docs/product/<文件名>.md"

# 全部恢复（谨慎，会覆盖当前根 AGENTS.md）
git mv "_停用/20261006/AGENTS.md" "AGENTS.md"
```

## 停用后仍然生效的内容

以下内容**没有**被停用，继续有效：

- `scripts/deploy-web.sh`：生产发布守卫（重建版禁止发布）
- `docs/operations/DEPLOY-BOUNDARY.md`：上线切换条件
- `docs/knowledge/**`：V1/V2 归档索引
- `_系统/**`：当前项目 / 当前工作 / 协作约定
- `docs/product/designer/G1-迭代包.md`：设计师 G1（其引用的门禁规范已停用，需重写后再对齐）
- 根 `AGENTS.md`：仅保留三条底线（业务事实源、禁止发布生产、App 兼容优先）
