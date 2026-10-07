# Web 多分辨率收尾回归（Batches 4–7 新增页面）

> 批次：`WEB-RELEASE-PREP-20261007`
> 类型：`REAL_BROWSER_MULTIRES`
> 状态：11 条路由 × 3 档分辨率（1440/1280/1024）无横向溢出 PASS
> 日期：2026-10-07

## 1. 方法

真实浏览器（Playwright）以 BOSS 账号登录，逐路由在 1440×900 / 1280×800 / 1024×768 三档下读取
`document.documentElement.scrollWidth` 与 `window.innerWidth`，判定是否产生页面级横向溢出。

## 2. 结果

| 路由 | 1440 | 1280 | 1024 |
| --- | --- | --- | --- |
| `/workbench`（岗位视角） | ok | ok | ok |
| `/workbench/risk`（风险队列） | ok | ok | ok |
| `/workbench/customers`（本店客户） | ok | ok | ok |
| `/workbench/team-overview`（团队经营概览） | ok | ok | ok |
| `/workbench/team-customers`（本团队客户） | ok | ok | ok |
| `/workbench/my-customers`（我的客户） | ok | ok | ok |
| `/workbench/overview`（经营总览） | ok | ok | ok |
| `/workbench/organization`（组织效能） | ok | ok | ok |
| `/finance/workbench` | ok | ok | ok |
| `/finance/receivables` | ok | ok | ok |
| `/finance/ledger` | ok | ok | ok |

`scrollWidth == innerWidth` 全部成立，无横向滚动。

## 3. 清理

`/workbench/risk` 触发的风险处置单同步已删除（`db_risk_item=0 / log=0`）；只读浏览，无业务写入。

## 4. 未覆盖

- 控制台 error 计数未在本轮逐路由采集（各角色 G3 已分别记录 0 error：Designer、Finance 只读/写入、StoreManager、TeamLeader、Marketer）。
- 1280×800 与 1024×768 之外的极端宽度（如 1920、768）未纳入本轮。
- 金额/成本区块的逐页口径核对由各角色 G3 覆盖。
- 生产环境：未触及。
