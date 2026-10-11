# StoreManager S1：菜单冻结落地 + 页面清单与断点登记

- 日期：2026-10-11
- 批次：`STOREMGR-S1-20261011`
- 依据：`docs/product/storemanager/WEB-STOREMANAGER-{ROLE-NATURE-AND-MINDSET,PAGE-INVENTORY,MENU-FROZEN}.md`
- 环境：Web `http://127.0.0.1:8080` + 后端 `http://127.0.0.1:8090`；账号：店长 王洪文 19900000003

## 一、本轮产出

1. **S0 角色定位**：`WEB-STOREMANAGER-ROLE-NATURE-AND-MINDSET.md` —— 店长=本店经营结果第一责任人（看结果、管资源、不改账）；与 Designer/Pm/Finance 的九维差异表；四条思维公理（只看本店 / 要结论与干预 / 成本毛利可见但不放大 / 能确认内部节点但不替业主确认）；App 能力基线与 Web 现状对照表。
2. **S1 页面清单 + 主链责任矩阵**：`WEB-STOREMANAGER-PAGE-INVENTORY.md` —— 店长可达页面清单（路由守卫事实表）+ 主链 16 步可达性 + **10 条缺口**。
3. **S1 菜单冻结稿**：`WEB-STOREMANAGER-MENU-FROZEN.md` —— 4 组 12 项 + 裁决 D1–D7 + 命名对照。

## 二、本轮落地（低风险两项）

| # | 改动 | 说明 |
| --- | --- | --- |
| 1 | 店长菜单按冻结稿重排 | 移除「项目推进 → `/workbench?surface=project`」（`WorkbenchHomeView` 不消费 `surface`，**点了没反应**）；分组改为 今日 / 本店客户 / 本店履约 / 本店经营；「客户跟进」→「本店客户」；补只读入口「薪酬与考勤（只读）」；标签对只读能力显式标注「（只读）」 |
| 2 | 场景矩阵过期标注修正 | `WEB-ROLE-SCENARIO-MATRIX.md` 中 StoreManager 行原写「`GAP-WEB-008` OPEN」，实际已 CLOSED（2026-10-07）→ 按 `EXP-015` 修正并指向本清单 |

未新增未注册菜单 key（复用已注册 key，`check:workbenches` 无新告警）。

## 三、门禁

`type-check` PASS；`build` PASS；`check:workbenches` / `check:workspaces` / `check:page-system` PASS。

## 四、真实浏览器复验（店长 王洪文）

| # | 检查项 | 结果 |
| --- | --- | --- |
| 1 | 菜单项数 | ✅ **12 项**（业务工作台 / 本店客户 / 待我谈单 / 待我签约 / 主材选材 / 增减项 / 整改跟进 / 客户意见投诉 / 待我处置风险 / 资金台账（只读）/ 本店薪酬（只读）/ 薪酬与考勤（只读）） |
| 2 | 死参数项已移除 | ✅ 菜单中不再出现「项目推进」 |
| 3 | 只读入口可见 | ✅ 三个只读项均可见且可进入（`EXP-021` 纪律） |
| 4 | 1440×900 | ✅ 无横向溢出 |
| 5 | 控制台 | ✅ Errors 0 / Warnings 0 |

截图：`storemgr-menu-1440x900.png`

## 五、登记的关键断点（**未修，待裁决**）

| 断点 | 事实 | 为什么要裁决 |
| --- | --- | --- |
| 项目开工 / 阶段撤销对店长不可达 | `/pm` 路由 `meta.roles=['Pm','Boss']`，**不含店长**；而 App 明确给店长 `act:startStage`（2026-09-23 用户裁决） | 属**能力与路由不一致**，放行或另建入口都需产品/业务确认 |
| 项目成员指派入口在店长不可进的页面 | 「项目成员」卡在 `/designer/projects`，店长被守卫拒；而后端 `requireMemberEditor` 明确含**本店店长** | 同上（`XA-016` 的店长侧未闭环） |
| 考勤编辑入口对店长不可见 | 考勤抽屉按钮按 `canWrite` 隐藏，而 App 给店长 `edit:attendance` | 与 `EXP-021` 同族；需按「能否进入/能否写」分别判定 |
| 门店经营结果无页面 | 后端 `statistic/store/report` **已存在**，Web 未接；店长有 `view:cost` | 需产品确认页面范围（成本毛利展示边界） |
| 指派设计师无 Web 入口 | App 有 `act:assignDesigner` | 需确认 Provider 与动作注册 |
| 注册表 deepLink 对店长不可解析 | `customer.followup → /designer/customers`、`pm.project → /pm/workbench` 均被店长守卫拒 | **结构性问题**：同一 workbench 被多角色共用时，单一 `deepLink` 无法对所有角色成立 |
| 谈单队列被后端门禁拦 | `GAP-WEB-016`（OPEN） | 既有裁决项 |

## 六、未覆盖

- 三档分辨率（本轮只验 1440，菜单为侧栏，风险低）；
- 菜单 12 项未逐一点击复验（本轮验证"存在 + 可达性事实已在文档中逐条核对"）；
- 断点均未修（属裁决项）。
