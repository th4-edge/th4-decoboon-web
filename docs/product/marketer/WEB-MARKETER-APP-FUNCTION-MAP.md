# 业务员（Marketer）App → Web 功能映射（详细）

> 阶段：**S0 补充（App 功能详查）** ｜ 日期：2026-10-11
> 触发：用户裁决 ——「详细应用 App 端业务员的**全部功能**，基于业务员角色去更好地使用 Web 推进日常业务工作」。
> App 事实源：`th4-decoboon-app/src/roles/permission.ts`（能力矩阵）、`src/roles/catalog.ts`（Tab + 首页快捷）、`src/roles/guard.ts`（页面级 `anyOf` 能力）、`src/pages/mine/index.vue`（我的页可见项）、`src/domains/statistic/api.ts`（`statistic/marketer/report`）。
> **本文件取代** `WEB-MARKETER-MENU-FROZEN.md` 早前版本里「入口少是结论」的判断（见 §0）。

---

## 0. 结论修正：上一轮「薄」的判断**作废**

| 项 | 上一轮判断 | 实测（App 事实） | 处置 |
| --- | --- | --- | --- |
| 业务员 Web 形态 | 「1 个业务页面 + 共享壳，入口少是结论」 | App 侧业务员有 **4 个 Tab + 6 个首页快捷 + 29 个可达页面 + 19 项能力** | ❌ **作废**：按 App 全量对齐，分批复刻 |
| 我的业绩 | 「不做（指标未冻结）」 | App 有 `view:performance` → `statistic/marketer/report`（字段极全，见 §5） | ❌ **作废**：要建 |
| 提成 | 「不可见」 | App 有 `view:commission` | ⚠️ 待确认承载页（App 未见独立入口，疑在薪酬/业绩内） |
| 量房 | 「不设独立入口」 | App 有 `view:measure-workbench` + 首页快捷「我的量房」 → `/subpackages/customer/pages/measure-workbench` | ❌ **作废**：要建「我的量房」 |
| 客户意见投诉 | 未纳入 | App 业务员有 `view:feedback` → 我的页「客户意见投诉（受理、回复和关闭客户事项）」 | 要纳入（Web 现为只读，见 §4） |
| 项目 | 「只读信息在客户抽屉里即可」 | App 有「项目」Tab + 首页快捷「签约后流转」，含项目详情/阶段/施工计划/成员/相册/日报 | ❌ **作废**：要建只读项目面 |

**为什么上一轮会判错**：我只查了 **Web 侧**的动作注册表（`business-action-policies.json` 里 7 个 `Marketer` 动作），没有查 **App 侧的能力矩阵与入口声明**。教训：**App 为准（公理 A1）意味着"以 App 的能力矩阵和入口声明为准"，而不是"以 Web 已有的注册表为准"**——Web 注册表只是"Web 已经做了什么"的快照，不是业务上限。

## 1. App 侧业务员能力矩阵（19 项，逐项）

来源：`permission.ts` 的 `INTERNAL_READ_ONLY_BUSINESS_CAPABILITIES`（6 项，全内勤共享）+ `marketer` 块（13 项）。

| # | 能力 | 含义 | Web 侧对应 |
| --- | --- | --- | --- |
| 1 | `view:customers` | 看本人客户 | ✅ `customer/customer/page`（`Self`） |
| 2 | `view:myProjects` | 看本人参与项目 | ✅ `project/project/page` |
| 3 | `view:design` | 只读设计/方案 | ✅ `design/scheme/page` |
| 4 | `view:quote` | 只读报价 | ✅ 报价列表/详情 Provider |
| 5 | `view:feedback` | 客户意见投诉 | ⚠️ `project/feedback/page` 有；Web 页面仅 designer 域可达 |
| 6 | `view:catalog` | 报价项目库（只读） | ✅ `/designer/catalog`（designer 域，需只读授予） |
| 7 | `view:package-template` | 套餐模板（只读） | ⚠️ 待核 |
| 8 | `view:payment-plan-template` | 付款计划模板（只读） | ⚠️ 待核 |
| 9 | `view:construction-plan-template` | 施工计划模板（只读） | ⚠️ 待核 |
| 10 | `view:ownPayslip` | 我的工资条 | ✅ `/account/payslips` |
| 11 | `act:followCustomer` | 写跟进 / 登记客户 | ✅ `customer/customer-follow/save`、`customer/customer/save` |
| 12 | `act:recordWechat` | 微信登记 | ✅ `customer/customer/wechat`（**页内无入口**） |
| 13 | `act:recordVisit` | 到店/拜访登记 | ✅ `customer/customer/visit`（**页内无入口**） |
| 14 | `act:scheduleMeasure` | 安排量房 | ✅ `customer/customer/measure` |
| 15 | `act:inviteCustomer` | 邀请客户（业主加入项目） | ❓ 待核 Provider |
| 16 | `view:notice` | 消息通知 | ✅ `/messages`（顶栏已有） |
| 17 | `view:performance` | 我的业绩 | ❌ **Web 缺 Provider**（`statistic/marketer/report`） |
| 18 | `view:measure-workbench` | 量房工作台 | ❌ **Web 缺页面** |
| 19 | `view:commission` | 提成 | ⚠️ **能力已声明、App 未落地入口**（全仓 grep 无页面使用）→ 业务澄清项，非待实现项 |

**明确没有的能力**（负向，别自作多情）：`view:cost`、`view:finance`、`view:supply`、`view:worker`、`view:team`、`edit:*`（除跟进/量房外）、`act:assignDesigner`、`act:talk`、`act:quote`、`view:selection-board`、`view:rectify`、`view:payroll`、`edit:attendance`。

> ⚠️ 与 `WEB-MARKETER-MENU-FROZEN.md` 早前「明确不做」清单的差异：那份清单里「我的业绩」「量房」写成了"不做"，**已作废**；「业务员财务页 / 成本利润 / 工人档案 / 指派设计师 / 跨业务员客户」仍然成立（App 能力矩阵同样没有）。

## 2. App 侧入口级结构

### 2.1 Tab（4 个，`ROLE_TABS.marketer`）

```text
工作台(home) / 客户(customer) / 项目(project) / 我的(mine)
```

### 2.2 首页快捷入口（6 个，`ROLE_ACTIONS.marketer`）

```text
我的量房     ruler      → 量房工作台（view:measure-workbench）
我的客户     user       → 客户列表（view:customers）
登记客户     edit       → 客户新建（act:followCustomer）
签约后流转   briefcase  → 项目列表
我的业绩     chart      → 业绩页（view:performance）
消息通知     bell       → 消息列表（view:notice）
```

### 2.3 「我的」页对业务员可见（按 capability 过滤后的实际结果）

| 分区 | 业务员可见项 |
| --- | --- |
| 账号与企业 | 个人信息、我的企业、账号密码、**退出企业** |
| 经营资料（**只读**） | 报价项目库、套餐模板、付款计划模板、施工计划模板 |
| 业务 | 内容任务、我的内容、**客户意见投诉**、**我的业绩**、我参与的项目 |
| 薪酬 | **我的工资条** |
| 支持 | 消息通知、使用帮助、联系客服、关于装得清 |

> 注意两处容易漏的：**①「内容任务 / 我的内容」对全部内勤无条件开放**（`if (employee)`），属于内容获客模块——业务员是它的天然使用者；**②「我参与的项目」**是业务员进入项目面的第二个入口。

## 3. App 侧可达页面全清单（29 项，按 `guard.ts` × 业务员能力求交）

| # | App 页面 | 能力 | 进入方式 |
| --- | --- | --- | --- |
| 1 | `/pages/index/index` 工作台 | — | **Tab** |
| 2 | `/pages/customer/list` 客户列表 | view:customers | **Tab / 快捷** |
| 3 | `/pages/project/list` 项目列表 | view:myProjects | **Tab / 快捷** |
| 4 | `/pages/mine/index` 我的 | — | **Tab** |
| 5 | `customer/pages/measure-workbench` 量房工作台 | view:measure-workbench | **快捷「我的量房」** |
| 6 | `customer/pages/edit` 客户新建/编辑 | act:followCustomer | **快捷「登记客户」** |
| 7 | `statistic/pages/performance` 业绩 | view:performance | **快捷 / 我的页** |
| 8 | `message/pages/list` 消息 | view:notice | **快捷 / 我的页** |
| 9 | `customer/pages/customer-picker` 客户选择器 | view:customers | 上下文子页 |
| 10 | `customer/pages/property-picker` 房屋选择器 | view:customers | 上下文子页 |
| 11 | `customer/pages/detail` 客户详情 | view:customers | 上下文子页 |
| 12 | `customer/pages/follow` 写跟进 | act:followCustomer | 上下文子页 |
| 13 | `customer/pages/measure` 安排量房 | act:scheduleMeasure | 上下文子页 |
| 14 | `design/pages/list` 设计列表 | view:design | 上下文子页（只读） |
| 15 | `design/pages/design-picker` 方案选择器 | view:design | 上下文子页 |
| 16 | `design/pages/talk` 谈单资料 | view:design | 上下文子页（只读） |
| 17 | `quote/pages/catalog/manage` 报价项目库 | view:catalog | 我的页（只读） |
| 18 | `quote/pages/list` 报价列表 | view:quote | 上下文子页（只读） |
| 19 | `quote/pages/package-manage` 套餐模板 | view:package-template | 我的页（只读） |
| 20 | `quote/pages/package-picker` 套餐选择器 | view:quote | 上下文子页 |
| 21 | `plan/pages/payment-list` 付款计划模板 | view:payment-plan-template | 我的页（只读） |
| 22 | `plan/pages/construction-list` 施工计划模板 | view:construction-plan-template | 我的页（只读） |
| 23 | `quote/pages/detail` 报价详情 | view:quote | 上下文子页（只读） |
| 24 | `project/pages/detail` 项目详情 | view:myProjects | 上下文子页（只读） |
| 25 | `project/pages/plan` 施工计划 | view:myProjects | 上下文子页（只读） |
| 26 | `project/pages/members` 项目成员 | view:myProjects | 上下文子页（只读） |
| 27 | `project/pages/album` 项目相册 | view:myProjects | 上下文子页（只读） |
| 28 | `project/pages/stage/detail` 阶段详情 | view:myProjects | 上下文子页（只读） |
| 29 | `project/pages/report/daily` 施工日报 | view:myProjects | 上下文子页（只读） |
| 30 | `project/pages/feedback-list` 意见投诉列表 | view:feedback | 我的页 |
| 31 | `project/pages/feedback-edit` 意见投诉详情/回复 | view:feedback | 上下文子页 |
| 32 | `project/pages/invite` 邀请客户 | act:inviteCustomer | 上下文子页 |
| 33 | `payroll/pages/my-payroll`（我的工资条） | view:ownPayslip | 我的页 |

> 33 行 > 29：其中 4 行是同一路由在不同能力下的重复出现（`projectMembers` 等），以 `guard.ts` 实际规则数为准（29 条规则命中）。

## 4. App → Web 逐项处置表（核心）

处置口径：**入口级 App 能力 = Web 必须有对应入口**；**上下文子页 = Web 由父页面（客户/项目工作面）的抽屉或详情区承接**，不必各占一个菜单项（`DEC-034`：对象不进菜单）。

| # | App 能力/入口 | Web 处置 | 承载 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | 工作台 Tab + 今日主线 | 业务工作台（首页卡片） | `/workbench` | ✅ 已建 |
| 2 | 我的客户（Tab + 快捷） | 菜单「我的客户」 | `/workbench/my-customers` | ✅ 已建 |
| 3 | 登记客户（快捷） | 「我的客户」页**主行动按钮** + 首页卡片 | 同页（不占独立菜单项） | ⏳ 待建（页内） |
| 4 | 我的量房（快捷） | 菜单「我的量房」 | `/workbench/measure` | ✅ **已建（M-2，2026-10-11）** |
| 5 | 项目 Tab + 签约后流转（快捷） | 菜单「签约后流转」 | `/workbench/my-projects` | ✅ **已建（M-4）** |
| 6 | 我的业绩（快捷 + 我的页） | 菜单「我的业绩」 | `/workbench/my-performance` | ✅ **已建（M-3，2026-10-11）** |
| 7 | 消息通知（快捷 + 我的页） | **顶栏通知入口**（已有） | `/messages` | ✅ 已建（不占菜单项） |
| 8 | 客户意见投诉（我的页） | 菜单「客户意见投诉（只读）」 | `/workbench/customer-feedback` | ✅ **本轮已挂**（只读；回复动作待 `GAP-WEB-015`） |
| 9 | 我的工资条（我的页） | 首页卡片 | `/account/payslips` | ✅ 已建（`GAP-WEB-023` 待拍是否进菜单） |
| 10 | 微信登记 / 到店登记（capability，页内动作） | 「我的客户」页内动作 | 同页 | ⏳ 待建（页内） |
| 11 | 只读设计 / 报价 / 谈单资料 | 客户工作面的只读区 | `/workbench/my-customers` 详情 | ✅ 部分已建（只读抽屉） |
| 12 | 只读项目详情/阶段/**任务** | 「签约后流转」页内只读区 | 同 #5 | ✅ **已建（M-4）**；⚠️ **成员/相册/日报不在业务员范围**（App 详情页对 marketer 显式不加载），已更正 |
| 13 | 报价项目库（我的页，只读） | 「经营与工具」只读入口 | `/designer/catalog` 授予只读，或新建只读视图 | ⏳ 待裁决（复用 vs 新建） |
| 14 | 套餐/付款计划/施工计划模板（只读） | 「经营与工具」只读入口 | 待核 Web 是否已有页面 | ⏳ 待核 |
| 15 | 内容任务 / 我的内容 | 「经营与工具」 | 需先确认 Web 是否有该域 Provider | ⏳ 待核（可能超出本批） |
| 16 | 邀请客户 | **不做**：App 页面 `role !== 'marketer'` 显式排除（能力矩阵虽声明） | — | ❌ **更正为不做**（见 `WEB-MARKETER-POST-SIGN.md` §四） |
| 17 | 提成 | 薪酬只读 | 承载页待确认 | ⏳ 待核 |

## 5. Web Provider 现状

| 需要 | Web 现状 | 结论 |
| --- | --- | --- |
| `statistic/marketer/report` | **缺**（Web `statistic/api.ts` 只有店报里的 `marketerCount`） | **需补 Provider**。App 已在用（`statisticApi.marketer()`）→ **不算新开 API**（公理 A2）。字段含：客户数/跟进中/待量房/已报价/签约/流失、转化率、平均转化天数、日周月录入客户与跟进数、量房率、业务员与门店排名、我的排名、最近客户、最近项目 |
| 客户/跟进/量房/微信/到店 | ✅ 齐 | 直接复用 |
| 项目只读 | ✅ `project/project/page`、`project/stage/page`、`project/task/page`、`project/report/page` | 直接复用（按 `Self` 过滤） |
| 意见投诉 | ✅ `project/feedback/page` | 复用（只读） |
| 报价项目库/模板 | ⚠️ 待核对 | 待核 |
| 内容任务 | ⚠️ Web 疑无该域 | 待核（若 App 有而 Web 无，需先裁决是否纳入本批） |

## 6. 实现批次建议（按用户价值）

| 批次 | 内容 | 依赖 |
| --- | --- | --- |
| **M-1** | 「我的客户」补 8 动作（登记客户 / 编辑资料 / 微信 / 到店 / 休眠 / 恢复 / 新增维护房屋 / 写跟进守卫）+ 客户池筛选 | ✅ **已完成 2026-10-11**（`WEB-MARKETER-MY-CUSTOMERS.md`）；批量跟进与排序**阻塞**（App 无批量接口、后端无 sort 参数） |
| **M-2** | 「我的量房」（本人量房预约队列 + 预约/调整 + 进入客户） | ✅ **已完成 2026-10-11**（`WEB-MARKETER-MY-MEASURE.md`；消费 App 已在用的 `statistic/boss/measure/report`） |
| **M-3** | 「我的业绩」（含补 `statistic/marketer/report` Provider） | ✅ **已完成 2026-10-11**（`WEB-MARKETER-MY-PERFORMANCE.md`） |
| **M-4** | 「签约后流转」（只读项目面：**按 App 实际加载范围**只做 info + 阶段 + 任务） | ✅ **已完成 2026-10-11**（`WEB-MARKETER-POST-SIGN.md`） |
| **M-5** | 收尾：修 2 个真问题（M-4 深链接竞态 / 业绩→客户可用性）+ 4 项待核下结论 | ✅ **已完成 2026-10-11**（`WEB-MARKETER-CLOSEOUT.md`）；catalog+模板 → **J-1**，内容任务 → **J-2**，提成 → 业务澄清 |

## 7. 纪律

1. **不新开 API**：只消费 App 已在用的 Provider；缺 Provider 时用 App 已有端点补（如 `statistic/marketer/report`）。
2. **只读边界**：业务员拿到的所有"别人域"页面一律**只读**，禁止把 designer/finance 的写入口带过来。
3. **静态菜单**：菜单/首页卡片只在 `src/roles/workbenchConfig.ts`、`src/roles/workbenchHome.ts` 显式声明；**未建页面不挂入口**（不留死链），建好即挂。
4. **金额边界**：成本/利润/毛利/现金流/工资/提成类区块按 App 能力矩阵；`view:commission` 存在但承载口径未确认前不臆造。
