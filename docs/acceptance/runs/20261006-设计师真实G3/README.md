# 设计师 Web · 真实账号 G3 验收（第一轮只读核验）

- 日期：2026-10-06
- 批次：`DESIGNER-REAL-G3-20261006`
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`
- 身份：设计师「董夏鹏」，昭青装饰 · 总店 · Self
- 分辨率：1440×900
- 数据：本地真实 Provider 数据，不是路由 Mock

## 一、验收范围

本轮以真实设计师账号只读打开以下页面，检查真实数据渲染、控制台、字段映射、权限边界和明显数据缺陷：

| # | 页面 | 地址 |
| --- | --- | --- |
| 1 | 今日工作 | `/designer/workbench` |
| 2 | 报价工作台列表 | `/designer/quotes` |
| 3 | 客户与设计 | `/designer/customers` |
| 4 | 合同交接 | `/designer/contract` |
| 5 | 项目工地 | `/designer/projects` |
| 6 | 报价项目库 | `/designer/catalog` |
| 7 | 我的业绩 | `/designer/performance` |
| 8 | 项目验收工作区 | `/designer/projects/232968907537776640/acceptance` |
| 9 | 项目增减项工作区 | `/designer/projects/232968907537776640/changes` |
| 10 | 项目主材选材工作区 | `/designer/projects/232968907537776640/materials` |
| 11 | 设计方案工作区 | `/designer/design/233066442830905344` |

## 二、验证结论

| 页面 | 结果 | 控制台 |
| --- | --- | --- |
| 今日工作 | PASS：真实报价队列与服务端数据渲染 | 0 error |
| 报价工作台列表 | PASS：43 条本人报价，筛选计数正常 | 0 error |
| 客户与设计 | PASS：26 位本人客户，自动选中客户，房屋 / 量房 / 方案 / 跟进真实数据可见 | 0 error |
| 合同交接 | PASS：已接受 / 已转项目队列和合同事实加载 | 0 error |
| 项目工地 | PASS：10 个参与项目，施工阶段、任务、现场和验收事实加载 | 0 error |
| 报价项目库 | PASS：100 条施工项目真实加载，销售价可见，成本未展示 | 0 error |
| 我的业绩 | PASS：真实客户 / 报价 / 项目汇总，签约金额、转化漏斗、明细加载 | 0 error |
| 项目验收工作区 | PASS：真实阶段、验收单和轮次加载 | 0 error |
| 项目增减项工作区 | PASS：真实变更队列、审批和签认状态加载 | 0 error |
| 项目主材选材工作区 | PASS：真实主材分项、选材文本和采购状态加载 | 0 error |
| 设计方案工作区 | PASS：真实方案、空间和设计项加载 | 0 error |

## 三、真实数据发现并修复的缺陷

### DEF-REAL-001 · 项目任务单位显示 `[object Object]`

- 现象：项目工地的任务数量显示为 `1 [object Object]`。
- 原因：后端 `unit` 是 `{key,value,name}` 枚举对象，`normalizeTask` 直接 `String(raw.unit)`。
- 修复：`normalizeTask` 改为读取枚举 `value/key` 并映射为 `㎡ / 项 / 个 / m` 等中文单位。
- 复验：真实项目任务显示为 `1 项`。

### DEF-REAL-002 · 现场动态时间显示「暂不可确认」

- 现象：项目工地现场动态记录时间无法显示。
- 原因：现场记录时间在 `createTime.dateTime` 或 `reportDate`，原解析直接读取对象。
- 修复：兼容 `reportAt / reportDate / createTime.dateTime`。
- 复验：真实现场动态显示 `2026-10-06 04:56`。

### DEF-REAL-003 · 报价版本对比把同一分项误判为“新增 + 删除”

- 现象：V3 对 V2 版本对比显示 6 项新增 + 6 项删除，但实际分项相同，只是重报后 itemId 变化。
- 原因：版本对比仅按 `itemId` 匹配；改版重报会生成新的行 ID。
- 修复：匹配顺序升级为 `itemId → catalogItemId → 名称+空间+规格+单位` 业务键，并消耗已匹配行。
- 复验：真实报价 V3 vs V2 显示 `新增 0 · 删除 0 · 变化 0`，不再产生假差异。

## 四、边界确认

- 设计师只看到本人客户、报价和项目。
- 报价页不展示成本、毛利和利润。
- 项目页不展示项目成本和利润，不推进 PM 节点。
- 报价项目库不展示标准成本、采购执行价和供应商历史价。
- 合同交接页不提供签署 / 生效动作。
- 验收页不提供业主确认或驳回动作。
- 主材选材页不实现客户自助确认或代登记入口。
- 增减项页不提供审批动作，不展示成本变化明细。

## 五、截图证据

- `raw/screenshots/REAL-WORKBENCH-1440x900.png`
- `raw/screenshots/REAL-QUOTES-1440x900.png`
- `raw/screenshots/REAL-CUSTOMERS-1440x900.png`
- `raw/screenshots/REAL-CONTRACT-1440x900.png`
- `raw/screenshots/REAL-PROJECTS-1440x900.png`
- `raw/screenshots/REAL-CATALOG-1440x900.png`
- `raw/screenshots/REAL-PERFORMANCE-1440x900.png`
- `raw/screenshots/REAL-PROJECT-ACCEPTANCE-1440x900.png`
- `raw/screenshots/REAL-PROJECT-CHANGES-1440x900.png`
- `raw/screenshots/REAL-PROJECT-MATERIALS-1440x900.png`
- `raw/screenshots/REAL-DESIGN-WORKSPACE-1440x900.png`

## 六、本轮未覆盖

1. 真实写链路：保存报价、提交客户、删除报价行、上传文件、保存选材、提交验收、发起增减项、客户签认。
2. 1280 / 1024 真实数据三档复验（当前真实 G3 只验 1440，三档布局冒烟已在各 Mock 批次完成）。
3. 键盘全路径和焦点回归。
4. 非设计师账号、其他设计师客户、跨门店项目的权限负向真实复验。
5. 文件上传的私有 URL 过期、权限拒绝和失败恢复。
6. 生产环境发布边界和回滚验证。
