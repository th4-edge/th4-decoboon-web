# Web 业务员（Marketer）页面清单

> 阶段：**S1 页面清单（v2，2026-10-11 全量对齐 App）**
> 上游：`WEB-MARKETER-APP-FUNCTION-MAP.md`（App 功能详查，**本版据此重写**）、`WEB-MARKETER-ROLE-NATURE-AND-MINDSET.md`（S0）
> 事实源：App `src/roles/{permission,catalog,guard}.ts` + Web 三份按角色静态源 + `docs/standards/business-action-policies.json`
> 断点类型：`NO_WEB_ENTRY` / `NO_WEB_PAGE` / `NO_WEB_PROVIDER` / `ROLE_GUARD_DENIED` / `BLOCKED_BIZ_DECISION`

---

## 0. 结论修正（v1 作废）

> **v1 结论「业务员 Web 形态 = 1 个业务页面 + 共享壳，入口少是结论」已作废。**
> 依据用户裁决：「详细应用 App 端业务员的**全部功能**」。实测 App 侧业务员有 **4 Tab + 6 首页快捷 + 29 条可达页面规则 + 19 项能力**（见 `WEB-MARKETER-APP-FUNCTION-MAP.md` §1–§3）。
> **根因**：v1 只查了 Web 侧动作注册表（"Web 已经做了什么"的快照），未查 App 侧能力矩阵与入口声明（"业务上限"）。**公理 A1「App 为准」要求以 App 能力矩阵与入口声明为准。**

## 一、可达性事实（2026-10-11 静态源实测）

| 项 | 事实 |
| --- | --- |
| 静态路由集合 | **13 条** |
| 静态菜单 | **3 项 / 3 组**：业务工作台、我的客户、客户意见投诉（只读） |
| 首页场景卡片 | **4 条**：客户跟进、客户意见投诉、全局搜索、我的工资条 |
| 业务员专属页面 | **1 个**（`MarketerCustomerView`）+ 复用 1 个（`DesignerCustomerFeedbackView`，只读） |
| 目标态（冻结） | **菜单 6 项 / 4 组**（3 项已建 + 3 项待建），见 `WEB-MARKETER-MENU-FROZEN.md` |

## 二、能力矩阵（App 19 项 → Web 落地状态）

> 逐项含义见 `WEB-MARKETER-APP-FUNCTION-MAP.md` §1。这里只给**落地状态**。

**已落地（8）**：`view:customers`、`view:myProjects`（Provider 有，页面待建）、`view:design`（只读抽屉）、`view:quote`（Provider 有）、`view:feedback`（**本轮挂上只读**）、`view:ownPayslip`、`view:notice`、`act:followCustomer`（部分）、`act:scheduleMeasure`。

**未落地（关键 6 项）**：

| 能力 | 缺什么 | 类型 |
| --- | --- | --- |
| `view:measure-workbench` | 页面（本人量房预约队列） | `NO_WEB_PAGE` |
| `view:performance` | **Provider + 页面** | `NO_WEB_PROVIDER` |
| `view:myProjects`（项目面） | 只读项目页（列表→详情/阶段/计划/成员/相册/日报） | `NO_WEB_PAGE` |
| `act:recordWechat` / `act:recordVisit` | 「我的客户」页内入口 | `NO_WEB_ENTRY` |
| `act:followCustomer`（登记客户） | 「我的客户」页主行动 | `NO_WEB_ENTRY` |
| `act:inviteCustomer` | 项目面内的动作 | `NO_WEB_ENTRY` |

**待核（3 项）**：`view:catalog` / `view:package-template` / `view:payment-plan-template` / `view:construction-plan-template`（Web 是否有可复用的只读承载）、`view:commission`（承载页）、内容任务/我的内容（Web 是否已有该域）。

## 三、App → Web 覆盖度对照

完整逐项处置表见 `WEB-MARKETER-APP-FUNCTION-MAP.md` §4。摘要：

| App 入口级 | Web 目标 | 状态 |
| --- | --- | --- |
| 工作台 Tab | 业务工作台 | ✅ |
| 客户 Tab + 快捷「我的客户」 | 菜单「我的客户」 | ✅ |
| 快捷「登记客户」 | 「我的客户」页主行动（不占菜单项） | ⏳ |
| 快捷「我的量房」 | 菜单「我的量房」 | ⏳ |
| 项目 Tab + 快捷「签约后流转」 | 菜单「签约后流转」（只读） | ⏳ |
| 快捷「我的业绩」 | 菜单「我的业绩」 | ⏳ |
| 快捷「消息通知」 | 顶栏通知（已有，不占菜单项） | ✅ |
| 我的页「客户意见投诉」 | 菜单「客户意见投诉（只读）」 | ✅ **本轮** |
| 我的页「我的工资条」 | 首页卡片 | ✅ |

## 四、缺口清单（按用户价值排序）

| # | 缺口 | 类型 | 处置 |
| --- | --- | --- | --- |
| 1 | ~~「我的客户」页缺已开放动作~~ | ✅ **已关闭（M-1，2026-10-11）** | 登记客户 / 编辑资料 / 记录微信 / 记录到店 / 休眠 / 恢复 / 客户池筛选 全部接线；见 `WEB-MARKETER-MY-CUSTOMERS.md` |
| 2 | ~~「我的量房」无页面~~ | ✅ **已关闭（M-2，2026-10-11）** | 新增 `/workbench/measure`，消费 App 已在用的 `statistic/boss/measure/report`；见 `WEB-MARKETER-MY-MEASURE.md` |
| 3 | ~~「我的业绩」无 Provider 无页面~~ | ✅ **已关闭（M-3，2026-10-11）** | 新增 `workbenchApi.marketerPerformanceReport()` + `/workbench/my-performance`；见 `WEB-MARKETER-MY-PERFORMANCE.md` |
| 4 | ~~项目只读面无 Web 页面~~ | ✅ **已关闭（M-4，2026-10-11）** | 新增 `/workbench/my-projects`；按 App 实际加载范围只做 **info + 阶段 + 任务**（日报/成员/验收/投诉不加载）；见 `WEB-MARKETER-POST-SIGN.md` |
| 5 | 客户池筛选 ✅ 已做（M-1）；**批量跟进仍缺** | `NO_WEB_ENTRY` | 批量跟进**阻塞**：App 侧无批量接口，实现需新开 API（违反公理 A2）→ 待 Provider/业务裁决；客户池排序同理（后端无 `sort` 参数） |
| 6 | 经营与工具只读（报价项目库、套餐/付款/施工计划模板） | ✅ **结论（M-5）**：**不进业务员菜单** → 移交 **J-1「经营资料只读」共享区**（App 亦在「我的」页；属全内勤共用查阅） | 见 `WEB-MARKETER-CLOSEOUT.md` |
| 10 | **提成 `view:commission`** | **能力已声明、App 无入口** | 归「业务澄清」，**不在实现批次**（避免凭空造页） |
| 7 | 内容任务 / 我的内容（App 对全部内勤开放） | ✅ **结论（M-5）**：Web **完全没有内容获客域**（无 Provider/页面）→ 移交 **J-2「内容获客」**（跨角色立项） | 见 `WEB-MARKETER-CLOSEOUT.md` |
| 8 | 客户意见投诉的「受理/回复/关闭」动作是否向业务员开放 | `BLOCKED_BIZ_DECISION` | **只读已挂**；动作待 `GAP-WEB-015` 裁决 |
| 9 | ~~「我参与的项目」入口（我的页）~~ | ✅ 与 #4 同一承载 | 「签约后流转」即该承载（M-4 完成） |

**明确不做（App 能力矩阵同样没有，继续不做）**：业务员财务页、成本/利润/毛利/现金流区块、工人档案、指派/改派设计师、跨业务员客户视图、主材选材写、整改跟进（`view:rectify` 业务员无）。

## 五、下一步

实现批次见 `WEB-MARKETER-APP-FUNCTION-MAP.md` §6（M-1 → M-5）。建议先做 **M-1 + M-2**（无 Provider 依赖、纯页面工作、直接补上"已开放却无入口"的能力）。
