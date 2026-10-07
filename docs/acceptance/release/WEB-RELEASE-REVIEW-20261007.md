# 装得清 Web 发布评审包（重建版）

> 批次：`WEB-ALL-ROLE-20261007`
> 评审对象：`th4-decoboon-web` 重建版（`dev` 分支）
> 状态：`READY_FOR_REVIEW`（**未授权生产发布**）
> 日期：2026-10-07

## 0. 发布前置结论（必须先读）

`scripts/deploy-web.sh` 当前**主动拒绝**发布本仓库：

```text
[deploy-web] 拒绝执行：th4-decoboon-web（重建版）尚未完成与线上功能对齐。
- 线上 Web 源码：../th4-decoboon-web-v1v2-archive（V1/V2，冻结）
- 切换条件：重建版达到功能对齐 + G3 渲染验收 + 全角色闭环验收通过，且用户明确授权切换
```

因此本文件是**评审材料**，不代表可上线。切换线上承载仓库必须由用户明确授权。

## 1. 范围与版本

- 仓库：`/Users/zhangwei/FutureFiles/安徽昭青/家装装修/装客宝/前端代码/th4-decoboon-web`
- 分支：`dev`
- 基线标签：`web-all-role-baseline-20261007`
- 候选标签：`web-all-role-rc1-20261007`
- 覆盖批次：Batch 0（治理基线）→ Batch 1 Designer → Batch 2 Pm → Batch 3 Finance → Batch 4 StoreManager → Batch 5 TeamLeader → Batch 6 Marketer → Batch 7 Boss

## 2. 门禁与构建

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 状态机注册 | `npm run check:states` | PASS |
| 动作注册 | `npm run check:actions` | PASS |
| 权限注册 | `npm run check:permissions` | PASS |
| 页面系统 | `npm run check:page-system` | PASS |
| 工作台导航 | `npm run check:workbenches` | PASS |
| 对象工作空间 | `npm run check:workspaces` | PASS |
| 类型检查 | `npm run type-check` | PASS |
| 构建 | `npm run build` | PASS |

## 3. 验收证据（按角色）

| 角色 | 关键证据目录 |
| --- | --- |
| Designer | `20261007-web-batch1-designer-real-g3`、`20261007-web-material-selection-real-g3` |
| Pm | `20261007-web-batch2-pm-real-g3`、`20261007-web-batch2-pm-write-real-g3`、`20261007-web-pm-evidence-acceptance-real-g3` |
| Finance | `20261007-web-finance-readonly-g3`、`20261007-web-finance-write-api-g3`、`20261007-web-finance-ui-write-g3`、`20261007-web-voucher-build-real-g3`、`20261007-web-finance-ui-idempotency-g3` |
| StoreManager | `20261007-web-storemgr-finance-readonly-g3`、`20261007-web-storemgr-risk-queue-g3`、`20261007-web-storemgr-transfer-assign-g3` |
| TeamLeader | `20261007-web-teamleader-overview-assign-g3` |
| Marketer | `20261007-web-marketer-customer-g3` |
| Boss | `20261007-web-boss-boundary-g3`、`20261007-web-boss-perspective-g3`、`20261007-web-boss-payroll-chain-g3` |
| 全角色 | `20261007-web-all-role-regression`、`20261007-web-multires-sweep` |

业主确认：`20261007-web-owner-api-simulation`（无业主会话，按用户裁决只做 API/后端回归；后端 `OwnerClosureAcceptanceTest` 24/24）。

## 4. 上线冒烟清单（切换授权后执行）

1. **登录**：7 个角色真实账号登录 → 落地页与角色一致；错误口令返回 `AUTH_FAILED`。
2. **工作台**：Boss 岗位视角切换 7 视图；StoreManager/TeamLeader/Marketer 各自工作台入口可达。
3. **客户写动作与回滚**：
   - Marketer 本人客户写跟进 → 回读 → 删除探测记录；
   - StoreManager 本店客户转交负责人 / 指派设计师 → 回读 → 还原；
   - TeamLeader 本团队指派设计师 → 回读 → 还原。
4. **项目/验收**：Pm 阶段开工 → 任务开始 → 提交验收；业主确认仅 Owner 会话（无会话时保持 Pending）。
5. **财务**：应收→收款→台账；应付→付款→台账；双击防重；凭证生成重打同号；**全部回滚并核对 0 残留**。
6. **权限负向**：店长/团队/业务员/设计师/项目经理调用财务写 → 403；非 Boss 调组织报表 → 403。
7. **只读边界**：成本/利润区块按角色生成；无权限不生成区块（不是 0）。
8. **多分辨率**：1440/1280/1024 无横向滚动（已预验，见 multires 报告）。
9. **控制台**：关键页面 console error/warning 计数为 0。

## 5. 回滚路径

- **当前生产 Web** 仍由归档库 `../th4-decoboon-web-v1v2-archive` 提供；本仓库 `scripts/deploy-web.sh` 拒绝执行。
- 若未来完成切换并需要回滚：恢复归档库承载 + 还原上一版构建产物；本仓库候选标签 `web-all-role-rc1-20261007` 仅用于重建版回退，不改变线上。
- 任何回滚不涉及数据库迁移（本批无 DDL）。

## 6. 未关闭风险（评审需知）

| 编号 | 主题 | 影响 |
| --- | --- | --- |
| `GAP-WEB-009` | TeamLeader 风险读侧缺失 | TeamLeader 风险队列入口不可用（403） |
| `GAP-WEB-010` | 客户负责人变更原因未落库 | 转交缺原因审计 |
| `GAP-WEB-011` | TeamLeader 成本字段越界返回 | 报告含 cost，前端已剔除，待后端收敛 |
| `GAP-WEB-012` | Marketer 量房结论录入口径冲突 | 业务员不可录量房结论 |
| `GAP-026` | TeamLeader 财务字段范围 | TeamLeader 财务可见字段未冻结 |
| `GAP-WEB-006` | 员工工资 L2 未接入 | 员工工资/提成页面依赖后续 Backend/App 能力 |
| 环境 | 本地 8090 为主仓库构建 | 本地验证未覆盖工作树的 DEC-035/任务 reopen 等提交 |

## 7. 评审结论建议

- 技术门禁与验收证据齐备，可进入**对齐评估**；
- **不建议在 GAP-WEB-009/010/011/012 关闭前切换线上承载**；
- 切换线上仓库需用户明确授权，并按第 4 节冒烟清单在生产前置环境执行。
