# 客户与设计 · 页面落地与布局冒烟验收

- 日期：2026-10-06
- 批次：`DESIGNER-CUSTOMER-DESIGN-20261006`
- 页面：`/designer/customers`、`/designer/design`
- 分辨率：1440×900 / 1280×800 / 1024×768
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`

## 本轮完成

1. 客户池：按本人负责客户加载，支持关键词和阶段筛选，展示客户、电话、小区、阶段、等级。
2. 客户 360：展示预算、面积、设计师、下次跟进、客户阶段。
3. 房屋上下文：同一客户多房屋显式选择当前房屋；量房和设计方案均以当前房屋为准。
4. 量房：展示量房状态、原始结构、尺寸记录、客户诉求和设计师结论；支持安排量房和登记量房结论。
5. 设计与方案：展示方案版本、状态、面积、空间数、设计项数；支持新建方案和状态推进；方案详情可进入 `/designer/design/:designId` 独立设计工作区。
6. 设计诉求：展示诉求 / 排斥点、分类、优先级和空间；支持新增结构化诉求。
7. 跟进时间线：展示服务端最近 100 条跟进记录；支持写跟进和下次跟进时间。
8. 设计师负向边界：页面只消费本人客户数据；不展示成本、毛利、供应商价或其他设计师客户。

## Provider 路由

| 用途 | Provider |
| --- | --- |
| 客户列表 | `customer/customer/page` |
| 客户详情 | `customer/customer/info` |
| 写跟进 / 跟进列表 | `customer/customer-follow/save`、`customer/customer-follow/page` |
| 安排量房 | `customer/customer/measure` |
| 房屋列表 | `property/property/page` |
| 量房列表 / 保存结论 | `property/measure/page`、`property/measure/save` |
| 方案列表 / 详情 | `design/scheme/page`、`design/scheme/info` |
| 新建方案 / 状态推进 | `design/scheme/save`、`design/scheme/update`、`design/scheme/build` |
| 设计诉求 | `design/requirement/page`、`design/requirement/save` |

## 验证结论

| 项 | 结果 |
| --- | --- |
| `npm run type-check` | PASS |
| `npm run build` | PASS |
| `/designer/customers` 三档渲染 | PASS（路由 Mock 数据） |
| 浏览器控制台 | 0 error / 0 warning |
| 客户、房屋、量房、方案、诉求、跟进渲染 | PASS（路由 Mock 数据） |
| 真实 Provider 数据与权限负向 | 待真实设计师账号登录后补验 |

## 真实数据补充验证 · 客户列表量房状态

- 问题：客户已完成量房，但左侧列表继续显示客户主表的旧状态「待量房」。
- 根因：`customer/customer/page` 已根据 `Completed` 量房记录返回行为标签 `measured`；前端此前只保留标签名称、未读取 `key`，展示时直接使用旧生命周期状态。
- 修复：保留 `measured` / `measure:scheduled` 标签语义；未进入报价前，已量房客户列表状态和客户 360 均显示「已量房」，下一步动作显示「进入设计与方案」；筛选「待量房」时排除已完成量房客户。
- 真实设计师账号实测：王爱人、招不了、吴桐、孙悦、林雪均由「待量房」纠正为「已量房」；施工中、已报价、已签约状态保持正确；当前数据下「待量房」筛选为 0 位；浏览器控制台 0 error；`npm run type-check`、`npm run build` PASS。

## 数据说明

本轮截图使用 Playwright 路由 Mock 提供合成客户、房屋、量房、方案和跟进数据，仅用于验证信息架构、三栏布局、状态表达和交互入口。

**这不是 G3 真实数据验收，也不代表这些写操作已在真实服务端通过。** 真实账号口令已于 2026-10-06 被外部会话重置。

## 截图

- `raw/screenshots/DESIGNER-CUSTOMERS-1440x900.png`
- `raw/screenshots/DESIGNER-CUSTOMERS-1280x800.png`
- `raw/screenshots/DESIGNER-CUSTOMERS-1024x768.png`

关联设计工作区验收见 `docs/acceptance/runs/20261006-设计方案工作区落地/`。

## 后续必须补验

1. 使用真实设计师账号进入 `/designer/customers`，确认只看到本人负责客户。
2. 使用真实客户 / 房屋验证量房、方案、诉求和跟进的写链路。
3. 补非设计师、跨门店、其他设计师客户的权限负向用例。
4. 真实数据下验证 1440 / 1280 / 1024 三档和键盘路径。
5. 客户登记 / 新增客户不在设计师侧本轮范围；设计师承接已分配客户，新增客户由业务员或负责人入口完成。
