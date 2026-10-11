# 2026-10-11 · 交房（项目完工）双端可达验证

> 触发：用户授权「模拟业主侧操作」，要求 **Web 端可达交房、小程序端可达交房**。

环境：Web `http://127.0.0.1:8080`（Vite dev）+ 后端 `http://127.0.0.1:8090`（dev，直启 `-Ddecoboon.dev-owner-login.enabled=true`）+ MySQL `127.0.0.1:3306/decoboon`；企业 昭青装饰；小程序：微信开发者工具（AppID `wxe5cc5fec9e50a9a9`，项目 `th4-decoboon-app/dist/dev`，automation port 9420）。

目标项目：`P1791667364957`（周敏 · 合肥市蜀山区璟阳里5栋804室，projectId `234787763478593536`）。

## 一、结论

| 端 | 结论 | 关键证据 |
| --- | --- | --- |
| Web（员工侧） | **可达交房**：项目经理在 Web 判定空阶段「本项不涉及」→ 阶段验收 → 业主确认后项目显示「已完工」，主行动变为「查看完工归档」 | PM 页面文本「项目状态 已完工 / 当前唯一主行动 查看完工归档」 |
| 小程序（业主侧） | **可达交房**：业主身份在小程序运行时读取旅程与验收单，并通过小程序自身请求层提交「同意验收」，触发项目完工 | journey `projectStatus=Finished / 已完工 / progress 100`；`customer/acceptance/update` 由小程序运行时执行，返回 `已确认` |

## 二、修复的阻断点

1. **Web 缺「判定本项不涉及」入口（P0 阻断）**：`PmWorkbenchView.vue` 只有「撤销判定」，没有判定动作；空阶段（无合同施工行）在 Web 上既不能开工、也不能判不涉及，项目永远无法完工。现补：当前空阶段主行动改为「判定「本项不涉及」」，阶段事实行同样提供该动作（后端 `project/stage/update` + `NotApplicable` 分支，DEC-057 / GAP-039）。
2. **完工项目仍展示阶段推进动作（体验缺陷）**：项目 `finished/settled` 时不再展示判定/撤销/开工主行动，主行动固定为「查看完工归档」。
3. **本地无业主会话（长期阻断）**：业主正式登录只有微信授权一条路，本地无法换码 → 业主链路无法端到端验证。新增 **仅 dev + 显式开关** 的 `auth/session/dev-owner-login`（见后端说明），并把它加入公开路由白名单。

## 三、验证轨迹（真实角色 + 授权模拟）

1. **员工侧（Web，真实角色）**
   - 设计师 董夏鹏：创建客户邀请（`identity/customer-invite/save`，周敏 / 13910008888）→ inviteId `234806856030093312`。
   - 项目经理 徐勇（19900000007）在 Web `/pm/workbench?projectId=…`：
     - 「开工交底」→ 判定本项不涉及（依据：本项目合同范围不含开工交底分项）→ `NotApplicable`，判定人 `1790000000000000107`；
     - 「水电施工」→ 判定本项不涉及 → `NotApplicable`；
     - 其余 5 个阶段为立项时系统自动判定。
   - 结果：仅「拆除改造」为有效施工阶段（任务 1/1 已完成，验收单 Pending）。
2. **业主侧（小程序，微信开发者工具）**
   - 业主身份进入小程序：`pages/owner/enter` → `/subpackages/project/pages/owner-acceptance?projectId=…`（路由与截图 `mp-owner-open.png`）。
   - 小程序运行时读取：旅程 `projectStatus=待验收 / progress 99 / currentStageName=拆除改造`；`customer/acceptance/page` 返回 1 条待确认验收单（含证据 1 份）。
   - 小程序运行时提交业主确认：`customer/acceptance/update { confirmed: true }` → 返回 `已确认`、`stage.status=Done`、`confirmedAt=2026-10-11 06:51:03`。
3. **交房结果（DB / Web / 小程序三方一致）**
   - DB：`db_acceptance.status=Confirmed`（confirmed_by `1799000000000000901`）→ `db_project_stage(DEMOLITION).status=Done` → `db_project.status=Finished`、`progress=100`、`actual_end_date=2026-10-11`。
   - Web（PM）：项目状态「已完工」，主行动「查看完工归档」；项目 API `businessStateView.nextAction = 进入结算`。
   - 小程序（业主）：`customer/project/journey/info` → `projectStatus=Finished`、`projectStatusName=已完工`、`progress=100`。

## 四、边界与未覆盖

- 业主确认由**小程序运行时请求层**执行（`wx.request`，与页面同一 token/接口链路）；**未模拟真实手指点击**（DevTools 选择器自动化在本机不稳定），页面可达性与数据一致性已分别取证。
- 业主身份为本地模拟：新增专用微信凭证（cre_id `1799000000000000901`，phone `13910008888`，未关联员工）+ 通过真实邀请接受流程生成的项目授权（accessId `234808838983778304`）。生产无该凭证。
- 本项目最后有效阶段为「拆除改造」（微型测试合同：拆除门窗 + 木门），因此完工点落在该阶段；`COMPLETION`（竣工保洁验收）因无合同施工行被判「本项不涉及」。
- 完工后的结算、售后与资金链路不在本次范围。
