# Web 业务员「我的预约量房」页（M-2）

> 阶段：**S5 实现** ｜ 批次：**M-2** ｜ 日期：2026-10-11
> 页面：`/workbench/measure` ｜ 组件：`src/views/workbench/MarketerMeasureView.vue`
> 上游：`WEB-MARKETER-APP-FUNCTION-MAP.md`（§6 批次）、`WEB-MARKETER-MENU-FROZEN.md`
> App 对应：`subpackages/customer/pages/measure-workbench.vue`（业务员标题 **「我的预约量房」**）

## 一、本批解决了什么

App 侧业务员有 `view:measure-workbench` 能力 + 首页快捷「**我的量房**」，Web **完全没有这页**——业务员在 Web 上看不到"我有哪些客户还没约量房/约了几点/逾期了没"。M-2 补上：

- 页面 `/workbench/measure`，标题「我的预约量房」（沿用 App 对业务员的称呼）；
- 菜单「客户经营 → 我的量房」+ 首页卡片（P0）；
- 汇总：量房事项 / 今日预约 / 已预约未完成 / 待派单 / **预约逾期** / 已完成 / 风险事项；
- 筛选：全部 / 未预约 / 已预约 / 待派单 / 逾期 / 已完成（**计数实时**）；
- 明细：客户 · 房屋地址 · 量房状态 · 预约时间 · 设计师 · 风险 · **服务端建议** · 操作（预约/调整量房、查看客户）。

## 二、Provider：**消费 App 已在用端点，不是新开接口**

| 项 | 结论 |
| --- | --- |
| 端点 | `statistic/boss/measure/report` |
| App 出处 | `domains/workbench/api.ts#bossMeasure`，被 `measure-workbench` 页面调用（`post(..., {})`，无查询参数） |
| 名称说明 | 端点名叫 `boss/measure`，但 App 的**共享量房工作台页面**（业务员/团队长/店长/负责人）都调它；服务端按登录角色裁剪范围 → **业务员得到本人客户**，因此 Web 侧对该页面**不做分组面板**（App 也只有跨业务员看板角色才显示分组） |
| Web 侧 | 新增 `workbenchApi.measureAppointmentReport()`（+ 两个模型类型），**不新增后端接口** |

> 与 M-1 的「批量跟进」形成对照：**同样缺能力**，M-2 用的是"App 已在用的端点"，所以可以直接做；批量跟进后端根本没有端点，所以只能登记等待。**判断标准是"App 是否已经在用这个端点的语义"，不是"我需不需要这个数据"。**

## 三、口径与 App 逐条对齐（不自造）

| 口径 | App 出处 | Web 实现 |
| --- | --- | --- |
| 筛选 7 项（全部/未预约/待派单/已预约/逾期/已完成/待交设计） | `measure-workbench.vue#filters` | 取其中业务员可行动的 6 项（**「待交设计」是管理角色视角**，业务员无动作，故未纳入本页） |
| **逾期 = 预约时间 + 4 小时未完成** | `#overdue()`（`scheduledAt + 4h < now`） | 同名同公式 |
| 各筛选项的判定 | `#matchesFilter()`（用服务端 `derivedState`） | **同逻辑照搬**，前端不自拼状态 |
| 行内时间文案 | `#timeText()`（完成/预约/尚未预约量房） | 同 |
| 行内地址文案 | `#addressText()`（`address` 优先，否则 community+building+roomNo） | 同 |
| 状态中文 | 服务端 `derivedStateName` | 直接展示，**前端不翻译** |

## 四、能力边界（本页明确不做）

| 不做 | 理由 |
| --- | --- |
| **指派/改派设计师** | `customer/designer-handoff` 角色 = `Boss / StoreManager / TeamLeader`，**业务员无**；「待派单」行只展示并提示"指派由店长/负责人执行" |
| **录量房结论** | `measure/save` 不含 Marketer（`GAP-WEB-012` CLOSED） |
| 分组面板（按业务员/来源/设计师） | 那是**跨业务员看板**角色（负责人/店长）的视角；业务员只看自己，分组无意义 |
| 「待交设计」筛选 | 交设计由店长/负责人执行，业务员无动作 |

## 五、深链接：多起点进入同一对象（**参数必被消费**）

本页的两处跳转都带对象锚点，「我的客户」页**真的消费**它们：

```text
「我的预约量房」→ 查看客户      → /workbench/my-customers?customerId=…
「我的预约量房」→ 预约/调整量房 → /workbench/my-customers?customerId=…&action=measure
                                     ↑ 该页 onMounted/watch 读取并选中客户；
                                       action=measure 时直接打开量房弹窗
```

- 客户不在本人范围时，「我的客户」页给出**明确说明**（"该客户不在您的客户范围内"），而不是静默无反应（`DEC-009` 归属边界要让人看见）；
- 参数不被消费就跳转＝死参数（`EXP-013`），本批把两端一起做了，避免了"加了入口才发现参数没人读"。

## 六、过程中的一个真实缺陷与修复

首次 `npm run build` **失败**：样式里用了 `$color-danger`，本项目 token 实际是 **`$danger-500`**。

- 影响面：`vue-tsc` **不会**检查 SCSS 变量 → 只有 `build` 才会暴露；
- 教训：**新增页面必须跑 `build`，不能只跑 `type-check`**（已在流程里如此执行，本次靠它拦下）。

## 七、验证与待复验

代码层：`vue-tsc` 干净 · `build` PASS · 九项 `check:*` 全 PASS · 静态源实测菜单 4 项全部可达。

**待浏览器复验**（仍受宿主负载 BLOCKED）：

1. 业务员账号下 `statistic/boss/measure/report` 是否返回**本人**明细（不应含他人客户）；
2. 「逾期」计数与行内文案是否一致（4 小时口径）；
3. 跳转「预约/调整量房」→ 我的客户页是否**选中该客户并打开弹窗**；
4. 跳转「查看客户」→ 客户不在本人范围时的提示文案；
5. 三档（1440/1280/1024）无横向溢出、控制台 0 error。

## 八、批次进度

| 批次 | 内容 | 状态 |
| --- | --- | --- |
| M-1 | 「我的客户」补 8 动作 + 客户池筛选 | ✅ 2026-10-11 |
| **M-2** | **「我的预约量房」（本文档）** | ✅ **2026-10-11** |
| M-3 | 「我的业绩」（含补 `statistic/marketer/report` Provider） | ⏳ 待做 |
| M-4 | 「签约后流转」（只读项目面） | ⏳ 待做 |
| M-5 | 经营与工具只读 + 提成 + 内容任务 | ⏳ 待核 |
