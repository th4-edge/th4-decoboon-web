# 2026-10-11 · 设计师「项目交付」闭环修复（增减项 / 主材选材 / 客户意见投诉 / 整改跟进）

> 触发：真实设计师（董夏鹏 19900000005）在 Web 端「一直保存不了增减项，业务开展不下去」，
> 同批反馈「主材选材、客户意见投诉、整改跟进」也不可用。

环境：Web `http://127.0.0.1:8080`（Vite dev）+ 后端 `http://127.0.0.1:8090`（dev profile）+ MySQL `127.0.0.1:3306/decoboon`；企业 昭青装饰（`com_id 1790000000000000001`）；浏览器 Chromium（playwright-cli 会话 `dc`，1440×900）。

## 一、结论

| 页面 | 修复前 | 修复后 |
| --- | --- | --- |
| 增减项（发起） | **保存必然失败**：`customerConfirmedAt` 用空格分隔提交，后端 `LocalDateTime` 转换异常（错误文案还是 `未定义错误信息:{0}`） | **PASS**：真实设计师提交成功，形成待审批变更单 |
| 增减项（明细行） | 点「选择目标分项」后**新增一行**，被点开的行永远空着 → `createReady` 恒为 false →「提交审批」永久禁用（现场即「不会用」） | **PASS**：第一个目标填入当前行，多选余下目标才追加新行 |
| 主材选材 | 工作区保存链路正常（已进入采购的行按业务规则锁定，提示走增减项） | **PASS**（本次未改代码，仅回归验证） |
| 客户意见投诉 | 设计师**一条都看不到、也答复不了**：`project/feedback/page|update` 只用 `DataScope`（业主投诉的 owner 是项目经理），与其它项目子对象（`visibleChild`）不一致 | **PASS**：设计师可见本项目投诉并提交处理回复（后端改用 `visibleChild`） |
| 整改跟进 | 只读队列 + 跳转阶段验收工作区提交复验；范围本就用 `visibleChild` | **PASS**（业主驳回为本地模拟：设计师队列 0/0→1/1、可进入验收工作区提交复验、形成第 2 轮；验证后已回滚） |

## 二、根因与改动

1. `src/domains/contract/api.ts`：新增 `isoDateTime()`，`saveContractChange` / `batchSaveContractChange` 的 `customerConfirmedAt` 统一 `YYYY-MM-DD HH:mm:ss → YYYY-MM-DDTHH:mm:ss`。
   - 依据：`domains/property/api.ts`、`domains/crm/api.ts` 已有同一口径；后端 `@AutoInject LocalDateTime` 只接受 ISO 分隔符。
2. `src/views/designer/DesignerContractChangesView.vue` `onPickerAdd()`：新增分项时第一个目标写入被点开的行，其余目标才 `push` 新行（替换分支行为不变）。
3. 后端 `project/service/feedback/page|update/support/*.java`：数据范围由 `DataScopeSpecification.visible(CustomerFeedback.class, scope)` 改为 `ProjectAccessContext.visibleChild(employee, CustomerFeedback.class, "project")`，与 `contract-change`、`acceptances`、`rectify` 等项目子对象口径一致。
   - 业务依据：`DEC-044` / `BR-037`「客户意见投诉对店长、设计师、财务开放查看」。
   - 新增回归：`src/test/java/com/th4/edge/decoboon/project/ProjectFeedbackScopeTest.java`（2 项）。
   - ⚠️ 该改动涉及数据可见范围，属权限类变更，需用户确认保留（详见交付说明）。

## 三、验证证据（真实账号 / 真实写入）

1. 增减项创建（修复后，真实设计师浏览器操作）：项目 `234787763478593536`（周敏 · 璟阳里5栋804室）→ 生成 `BC1791670617651`（Pending，金额 ¥27.40，客户线下确认 2026-10-11 09:30 陈先生 · 当面确认，证据 1 份）。
   - 回读：`POST /api/project/contract-change/page` → `BC1791670617651 / Pending / amount 27.40 / customerConfirmedAt 2026-10-11 09:30:00 / evidenceImages[0]=companies/.../contractchange/2026/10/...png`。
   - 该单已由发起人撤回（`Cancelled`），未产生金额/应收/任务/材料副作用。
2. 增减项多选：一次选择 3 个目标 → 明细行为 `["拆除--保温墙除","拆除--墙体拆除（12墙）","拆除--墙地砖拆除"]`，无空行。
3. 客户意见投诉：临时插入 1 条真实结构投诉（项目 `234787763478593536`，owner=项目经理 徐勇）→ 修复前 `page` 返回 `[]`、`update` 返回 404；修复后 `page` 返回该条、`update` 成功（`status=Resolved`、`handler` 变为董夏鹏）。Web 侧 `/workbench/customer-feedback` 该项目由「0 条记录」变为「1 条记录」。临时行已删除（见后端回滚记录）。
4. 主材选材：设计师在 `/workbench/materials/231848057782665216` 填写颜色/规格并「保存并交付财务下单」→ `status=已选材`、`selectionText=颜色/花色：浅灰；规格/型号：800*800；品牌：马可波罗`；验证后已回滚该临时选材行。
5. 门禁：Web `npm run type-check` + 9 项 `check:*` + `npm run build` 全 PASS；后端 `ProjectFeedbackScopeTest` 2/2 PASS，全量 `mvn -o test` 见后端工作记录。

## 三·补、第二轮：审批后段与整改跟进（2026-10-11 06:27–06:33）

### A. 增减项审批后段（真实双角色，结果保留）
- 设计师 Web 创建 `BC1791671274141`（彭静（演示30）· P1791410475126 · +¥27.40 · 客户线下确认 彭静 当面确认 10:00）；
- 企业负责人（张伟）在 `/workbench/contract-changes` 审批通过（结论「现场已确认，同意实施」，`approved_at 06:28:55`，状态 `CustomerConfirmed`）；
- 联动核对：合同 `current_amount 59670.27 → 59697.67`；应收 `4 行/59670.27 → 5 行/59697.67`（新增「变更款 · BC1791671274141」27.40，到期 2026-10-18）；施工项不产生材料行（材料计划 1 行不变）；任务 4 行不变。

### B. 整改跟进（业主驳回本地模拟，验证后回滚）
- 模拟驳回（按 `ProjectContext.confirmAcceptance` 写法）：验收单 `234789031722876928`（周敏 · 璟阳里5栋804室 · 拆除改造）`Pending → Rejected`，整改责任人为项目经理 徐勇，整改类型 施工整改，截止 2026-10-14（今天+3 天）。
- 设计师侧：`/workbench/rectification` `0/0 → 1/1`（第 1 轮 · 施工整改 · 徐勇 · 3 天后截止 · 完成整改后提交复验）；进入 `/designer/projects/234787763478593536/acceptance?stageId=…` 显示「业主驳回」+ 问题清单，「提交复验」可用；弹窗要求「验收说明 + 现场证据 + 整改说明 + 整改后照片」四项齐全。
- 设计师提交复验成功 → 第 2 轮（`round_id 234804946648694784`，`rectification_note` 记录，提交人 董夏鹏），验收单回到 `Pending` 等待业主确认。
- 回滚：删除第 2 轮及子表行、还原验收单与第 1 轮逐列原值、还原证据行；与 mysqldump 快照逐字段比对一致；`/workbench/rectification` 回到 `0/0`。

## 四、未覆盖 / 风险

- 业主驳回本身（业主本人微信授权会话）仍未验证（本地 BLOCKED_OWNER_SESSION）；本次以「按后端驳回写法模拟 + 验证后回滚」覆盖设计师侧可见性与复验提交。
- 增减项「审批通过」后的下游收款核销、材料采购与成本联动未逐项对账（本次只核对合同额、应收行、材料行与任务行）。
- 增减项审批后段（BOSS/财务审批 → 合同额与应收联动）本次未重跑，沿用 `2026-10-08-增减项迁移91与dev冒烟.md` 既有结论。
- 后端异常文案 `未定义错误信息:{0}` 由框架统一产出，本次未改；根因修复后该路径不再触发。
- 期间同一 Web 工作树存在另一路并发改动（`src/domains/contract/api.ts` 等共享文件），本次改动为定点追加，未覆盖其内容。

## 五、本地 dev 验证数据回滚

见后端仓库 `docs/operations/data-changes/2026-10-11-设计师页面闭环修复-本地验证数据回滚记录.md`。
