# Web 生产切换就绪复核（2026-10-10）

> 模式：全角色切换就绪，不是生产发布
> 环境：隔离本地 MySQL `127.0.0.1:3307` + Redis `127.0.0.1:6381` + 后端 `127.0.0.1:8091` + 前端 `127.0.0.1:8092`
> 数据边界：本机专用测试库；未修改生产数据库、生产配置或生产 Web `/`

## 1. 结论

- `npm run build` PASS。
- 前端 `check:forms/concepts/states/actions/metrics/permissions/page-system/workbenches/workspaces` 全部 PASS；`metrics` 仅保留既有的非阻断口径差异提示。
- 后端 Java 22 `mvn clean test` PASS：`661` 项测试，`0` failure，`0` error。
- 7 个角色真实密码登录成功，三档分辨率页面为 `200`，关键页无横向溢出、无错误告警、控制台 `0 error`。
- 键盘纯操作完成登录（手机号 → 密码 → 进入工作台）与 TeamLeader 风险队列侧栏跳转。
- TeamLeader 风险队列读侧、TeamLeader 成本脱敏、负责人变更原因与审计、主材选材版本追加均已在真实接口回读通过。
- 生产根路径仍未切换；当前可直接回滚 release 为 `/opt/decoboon-web/releases/20261007-010750`。

## 2. 已验证角色

| 角色 | 测试账号 | 关键结果 |
| --- | --- | --- |
| Boss | `18660219918` | 经营总览、组织效能、风险队列、本店客户 200；三档无溢出、控制台 0 error |
| StoreManager | `18055190856` | 工作台、本店客户、风险队列、资金台账、选材/投诉入口 200；三档通过 |
| TeamLeader | `19900000001` | 团队总览、本团队客户、风险队列 200；风险读侧 API 200；三档通过 |
| Marketer | `13866481710` | 我的客户、量房入口 200；仅“安排量房”，无“录量房结论” |
| Designer | `17682168406` | 跟进、量房、设计、谈单、签约、项目、方案模版、业绩、项目库等 200；三档通过 |
| Pm | `13856066773` | 项目工作台、整改、客户意见入口 200；三档通过 |
| Finance | `15156075712` | 财务工作台、应收/应付/台账、员工工资/提成等 200；三档通过 |

## 3. 关键闭环证据

### TeamLeader 风险队列与成本脱敏

- `statistic/risk/report`：TeamLeader 登录后 HTTP 200。
- `statistic/team-leader/report`：响应 `contains_cost=false`。
- 跨团队风险隔离单测：`BusinessAlertContextTest#teamLeaderSeesOnlyOwnTeamRiskQueue` PASS。

### 客户负责人变更原因与审计

真实 StoreManager 调用 `customer/customer/update`：

```text
转交 -> success=true owner=目标员工
恢复 -> success=true owner=原员工
customer/customer/status-log/page -> OwnerChange 日志 2 条
每一条均包含 reasonText、operator、operatorRole
```

### 主材选材版本

真实 Designer 对同一合同主材分项连续保存：

```text
save 1 -> selectionId=..., version=1
save 2 -> selectionId=..., version=2
item/page 回读 -> version=2，文本为第二次保存内容
```

### 键盘可达

- 登录：`Tab → 手机号 → Tab → 密码 → Tab → 进入工作台 → Enter`，落地 `/workbench`。
- TeamLeader：从业务工作台纯键盘 `Tab` 到 `/workbench/risk`，`Enter` 后进入风险队列。

## 4. 三档分辨率与截图

分辨率矩阵：`1440x900`、`1280x800`、`1024x768`。

截图目录：

`output/playwright/20261010-web-switch-readiness/`

关键截图：

- `boss-1440.png` / `boss-1280.png` / `boss-1024.png`
- `teamleader-1440.png` / `teamleader-1280.png` / `teamleader-1024.png`
- `designer-1440.png` / `designer-1280.png` / `designer-1024.png`
- `finance-1440.png` / `finance-1280.png` / `finance-1024.png`

## 5. 仍开放但不作为本次阻断

- `GAP-WEB-003`：报价模板一等 Provider 未建设；线上归档同样没有该共享能力，不是本次重构回归。
- `GAP-WEB-007`：存量业务对象选择器迁移仍为 `IN_PROGRESS`，当前静态检查通过。
- `GAP-WEB-015`：员工侧客户意见仍只开放 App 同等“提交处理回复→Resolved”。
- `GAP-026`：TeamLeader 受限字段是业务边界；当前实现只返回已授权字段，受限字段不生成。
- `check:metrics` 提示 `quoteFinalAcceptanceRate` 与 `monthReceiptAmount` 的正式口径差异；不得对外作为正式经营指标。

## 6. 生产切换边界

本次未执行生产发布。若要切换生产 `/`，需要用户明确授权，并按切换清单：

1. 重新构建并固定制品 SHA256。
2. 备份当前 `/opt/decoboon-web/releases/20261007-010750`。
3. 使用归档库发布路径或经确认的切换脚本，保留上一版 hashed 资源。
4. 切换后执行 7 角色登录、风险队列、负责人变更原因、选材版本、财务只读/越权负向和静态资源深链冒烟。
5. 失败立即回退到 `20261007-010750`。
