# Web 业务员「我的客户」页（M-1）

> 阶段：**S5 实现** ｜ 批次：**M-1** ｜ 日期：2026-10-11
> 页面：`/workbench/my-customers` ｜ 组件：`src/views/workbench/MarketerCustomerView.vue`
> 上游：`WEB-MARKETER-APP-FUNCTION-MAP.md`（§6 批次 M-1）、`WEB-MARKETER-MENU-FROZEN.md`（菜单冻结）
> 依据：App `roles/permission.ts#marketer` 能力矩阵 + `business-action-policies.json`

## 一、本批解决了什么

App 侧业务员有 8 个 `Self` 写动作，Web 之前**只有 2 个有入口**（写跟进、安排量房）——即"业务员能做的事，Web 只做得出四分之一"。M-1 把「我的客户」补成**完整的客户工作面**：

| # | 能力 | 动作 | 本批状态 |
| --- | --- | --- | --- |
| 1 | 写跟进 | `follow/save` | ✅ 原有（本轮补休眠/流失禁用守卫） |
| 2 | 安排量房 | `measure` | ✅ 原有（本轮补休眠禁用守卫） |
| 3 | **登记客户** | `customer/customer/save` | ✅ **新增**（页头主行动，复用 `CustomerCreateSheet`） |
| 4 | **编辑客户基础资料** | `customer/basic-update` | ✅ **新增**（行「更多」+ 详情抽屉，复用 `CustomerEditSheet`） |
| 5 | **记录微信** | `customer/wechat` | ✅ **新增**（行「更多」+ 详情抽屉） |
| 6 | **记录到店** | `customer/visit` | ✅ **新增**（行「更多」+ 详情抽屉，二次确认） |
| 7 | **设置休眠** | `customer/dormant` | ✅ **新增**（7 项原因字典，`Other` 必填说明，二次确认） |
| 8 | **恢复休眠** | `customer/resume` | ✅ **新增**（二次确认，恢复后阶段由服务端裁决） |
| 9 | 新增/维护房屋 | `property/property/save|update` | ✅ 原有（本轮把房屋档案提到详情抽屉，含状态中文与维护入口） |
| 10 | **客户池筛选** | `customer/customer/page?status=` | ✅ **新增**（10 个阶段标签页 + 关键词） |

## 二、业务规则落点（来自动作前置条件，非自造）

| 规则 | 来源 | 实现 |
| --- | --- | --- |
| 休眠客户**不写跟进、不安排量房** | App `canFollow` 判 `stage !== 'dormant'` | 行内与详情按钮禁用 + `notifyBlocked()` 给出恢复路径 |
| 已签约/施工中/已完工/已流失/已休眠 **不可再设休眠** | App `canSetDormant` 排除这 5 个阶段 | 详情按钮 `:disabled` + 行菜单项禁用 |
| 休眠**必须选原因**；选「其他」必须填说明 | `customer/dormant` 前置「休眠原因已填写」 | 原因下拉 + `Other` 时强制 textarea |
| 休眠需**二次确认**；**有未来量房预约不阻断** | `customer/dormant`（confirmation / preconditions） | `ElMessageBox.confirm` + 提示文案写明预约保留 |
| 恢复**不猜测恢复后状态** | `customer/resume` failureRecovery「不得猜测恢复状态」 | 只传 `customerId`，恢复结果由服务端返回后再回读 |
| 到店「每次记一次，前端不去重」 | `customer/visit` idempotency | 每次点击一次调用 + 确认弹窗 |
| 微信号可空、**≤64 字符** | `customer/wechat` 前置 | `maxlength=64` + 提交前长度校验 |
| 安排量房前**必须有房屋** | `measure` 前置「客户与房屋已建档」 | 量房弹窗内提供「新增房屋 / 维护当前房屋」 |
| 动作后**按 `reloadScopes` 回读** | 各动作 `reloadScopes` | 动作成功后 `load()`（客户事实）+ 抽屉内 `loadDetailFacts()` |
| 归属范围 `Self`，**前端不传授权字段** | `DEC-009`、`WEB-BATCH6` §2 | 请求体只带 `customerId`，不带 `empId/ownerId` |

## 三、口径与展示的单一来源（避免第二套映射）

| 内容 | 单一来源 |
| --- | --- |
| 客户阶段中文与色调 | `src/domains/crm/customerMeta.ts#CUSTOMER_STAGE_META`（含 `dormant` 已休眠） |
| 房屋状态中文与色调 | `src/domains/property/statusMeta.ts#propertyStatusMeta` |
| 休眠原因字典（7 项） | `src/domains/crm/dormant.ts#DORMANT_REASONS`（与 App `CustomerDormantReason` 同值） |
| 性别 / 客户来源枚举 | `src/domains/crm/options.ts`（值对齐后端枚举，前端不自造） |
| 阻断提示 | `src/core/blockedNotice.ts#notifyBlocked()` |

> 本批**删除了页面内自写的 `STAGE_LABEL`**（缺 `dormant`，会把"已休眠"显示成英文 key），改为引用 `CUSTOMER_STAGE_META`。

## 四、顺带修的两个问题

1. **模板结构**：`PropertyFormDrawer` 原本挂在根 `div` **之外**（多根节点），已移入页面根节点内；
2. **组件分层**：`CustomerCreateSheet` / `CustomerEditSheet` 原本放在 `src/views/designer/components/`，被业务员页复用会形成"跨角色目录依赖"。已移到 `src/components/customer/`（**纯移动 + 2 处 import 更新**，无行为变化），设计师两页同步更新引用。

## 五、本批不做（含理由）

| 不做 | 理由 |
| --- | --- |
| **批量跟进** | App 侧**没有批量接口**（只有单条 `customer/customer-follow/save`）；实现需新开 API 或 N 次串行写，两者都违反「不新开 API」与幂等纪律 → 登记待业务/Provider 裁决 |
| 客户池**排序** | `CustomerPoolQuery` 后端只支持 `keyword + status`，无排序参数 → 需 Provider 扩展，不在本批 |
| 量房结论录入、指派设计师、负责人变更 | 业务员无此能力（App 能力矩阵同样没有） |
| 成本/利润/现金流区块 | `BR-006`；App 业务员无 `view:cost` |

## 六、无浏览器验证（BLOCKED）+ 待复验项

真实浏览器回归仍受宿主负载阻塞（前几轮已证与本工程代码无关）。代码层已验证：`vue-tsc` 干净、`build` PASS、九项 `check:*` 全 PASS。

**待浏览器复验**：

1. 阶段筛选「已休眠」是否被服务端 `status=Dormant` 接受（若拒绝则空态，不报错）；
2. 行「更多」菜单在 1024 档是否溢出（操作列已 `fixed="right"`）；
3. 登记客户 → 列表出现新客户 → 归属为本人；
4. 休眠 → 跟进/量房按钮禁用 → 恢复 → 回到原阶段；
5. 三档（1440/1280/1024）无横向溢出、控制台 0 error。

## 七、实现批次进度

| 批次 | 内容 | 状态 |
| --- | --- | --- |
| **M-1** | 「我的客户」补 8 动作 + 客户池筛选（**本文档**） | ✅ **本轮完成** |
| M-2 | 「我的量房」（本人量房预约队列） | ⏳ 待做 |
| M-3 | 「我的业绩」（含补 `statistic/marketer/report` Provider） | ⏳ 待做 |
| M-4 | 「签约后流转」（只读项目面） | ⏳ 待做 |
| M-5 | 经营与工具只读（报价项目库/模板）+ 提成 + 内容任务 | ⏳ 待核 |
