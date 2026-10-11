# Pm S1 切片：菜单错配修正与角色化文案验收

- 日期：2026-10-11
- 批次：`WEB-PM-S1-SLICE-20261011`
- 范围：Pm 菜单信息架构冻结稿落地 + 注册表错配修正 + XA-018 文案修正（低风险切片，不含权限变更）
- 环境：Web `http://127.0.0.1:8080` + 后端 `http://127.0.0.1:8090`（本地 dev）；账号：项目经理 徐勇 19900000007

## 一、本轮完成

1. 新增 `docs/product/pm/WEB-PM-PAGE-INVENTORY.md`（四类页面资产清单 + G1.5 差距检查 + 主链责任矩阵 + 缺口）。
2. 新增 `docs/product/pm/WEB-PM-MENU-FROZEN.md`（菜单冻结稿，含裁决记录 D1–D6、命名对照、实施状态）。
3. `src/roles/workbenchConfig.ts`：Pm 菜单按冻结稿重排为 4 组 5 项；「增减项」由死参数 `/pm/workbench?surface=changes` 改为真实页面 `/workbench/contract-changes`；新增一级组「项目履约 / 材料与变更 / 履约协同」；**未新增未注册菜单 key**。
4. `docs/standards/workbench-navigation.json`：`pm.project.deepLink` 由 `/designer/projects`（设计师页面）修正为 `/pm/workbench`；`notes` 与 `primaryActionByState.label` 由设计师视角文案改为 PM 视角。
5. XA-20261011-018 文案修正：
   - `PmWorkbenchView.vue` 去掉「任务与阶段写动作未冻结前只展示事实」「任务/阶段动作注册未冻结，当前只读」两处与事实不符的表述；
   - `DesignerAcceptanceView.vue` 的提交人描述与返回按钮改为按角色渲染（Pm → 项目经理 / 返回项目推进）。
6. 登记 `GAP-WEB-019`（主材选材角色范围三方不一致），裁决前 Pm 菜单**不挂**「主材选材」，避免新增死链。

## 二、门禁

- `npm run type-check` PASS
- `npm run build` PASS
- 九项 `check:*` 全部 PASS
- `npm run check:workbenches`：**无 Pm 相关告警**（剩余告警为既有 designer.* / finance.* 项，与本次无关）

## 三、真实浏览器复验（项目经理 徐勇）

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 侧栏菜单 | **PASS**：`业务工作台 / 项目推进 / 待我验收·整改 / 增减项 / 客户意见投诉`，与冻结稿一致 | 浏览器实测 |
| 2 | 点「增减项」 | **PASS**：跳转 `/workbench/contract-changes` 并渲染增减项队列（修复前点击无任何变化） | 浏览器实测 |
| 3 | 工作台说明文案 | **PASS**：改为「阶段与任务动作按服务端动作策略开放，未登记动作只显示待业务确认」 | 浏览器实测 |
| 4 | 阶段验收工作区返回按钮 | **PASS**：显示「← 返回项目推进」 | 浏览器实测 |
| 5 | 阶段验收提交人描述（角色化） | **PASS**：组件 setupState 实测 `submitterLabel = '项目经理'`、`backLabel = '← 返回项目推进'` | 浏览器实测（canSubmit=false 时走阻断文案，故直接读取计算值） |
| 6 | 阶段状态 | **PASS**：`本项不涉及` 与 `待开始` 正确区分显示（XA-014 修复的连带确认） | 浏览器实测 |
| 7 | 控制台 | **PASS**：`/pm/workbench`、`/workbench/contract-changes` Console Errors 0 / Warnings 0 | 浏览器实测 |

## 四、本轮新发现（未修，登记）

1. **空阶段死结（与 XA-015 同族）**：项目 `234791066908229632` 的「木作吊顶」权重 100% 但**无施工任务** → `开工` 被拒（空阶段不得开工）、`提交验收` 也被拒（无施工任务）→ Pm 在该阶段**既不能开工也不能验收**。根因是阶段计划生成时未按合同施工行裁剪（XA-015）。属数据口径，转裁决。
2. **Pm 主链两个断点**（见 `WEB-PM-PAGE-INVENTORY.md` §4）：现场汇报无 Web 提交入口（`NO_WEB_ENTRY`）；主材选材被角色门禁拒绝（`ROLE_GUARD_DENIED`）。

## 五、后续

1. `GAP-WEB-019` 裁决后补 Pm「主材选材」菜单。
2. `GAP-WEB-015`（阶段计划生成）裁决后修空阶段死结。
3. S3：把「现场汇报提交」与 Pm 专属项目工作面写入 Pm G1 迭代包并取 `T06/T12`。
