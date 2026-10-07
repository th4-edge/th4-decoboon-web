# Boss 能力超集与外部确认边界 G3

> 批次：`WEB-BATCH7-BOSS-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：BOSS 内部能力超集、全企业范围与「不冒充业主」边界 PASS
> 日期：2026-10-07
> 上游：`DEC-015`、`DEC-032`、`BR-028`

## 1. 范围

- BOSS：`19900000001`（张伟，emp `1790000000000000101`，Company `1790000000000000001`）。
- 页面：`/workbench`（经营管控中心）、`/workbench/risk`、`/finance/workbench`。

## 2. 正向

```text
POST /api/statistic/risk/report          -> 全企业 37 条风险（high 1）
POST /api/finance/receivable/page        -> 可读全公司应收（Company 范围）
POST /api/statistic/boss/business/report -> 本月漏斗（线索 11 / 到店 0 / 量房 5 / 报价 …）
/workbench/risk  -> 风险队列渲染（KPI + 清单 + 处置动作）
/finance/workbench -> 财务工作台渲染，含「登记资金事实」写入口
```

管理导航「风险中心」已由 planned 改为真实入口 `/workbench/risk`（`src/roles/permission.ts`）。

## 3. 外部确认边界（关键反向）

```text
BOSS 调用 customer/acceptance/update（业主验收确认）-> 403 当前会话不是业主身份
```

注册表侧：`project/acceptance/confirm|reject` 角色仅 `Owner`；`project/contract-change/customer-confirm` 含 `Boss`（按 `DEC-015` 内部代登记，需签认证据）。

结论：BOSS 内部能力超集成立，但**不能冒充业主确认**，边界在注册表与实现层一致。

## 4. 清理

```text
仅只读验证 + 触发风险处置单同步（由 risk/report 按业务规则创建）；
未执行任何写动作；未重置凭证
```

## 5. 未覆盖

- 一人装企连续操作（制单→确认→发放→台账→工资条）逐步留痕：需 G2 落地岗位视角 UI 后做全链 G3。
- 管理导航「经营总览 / 业务分析 / 项目监管 / 组织效能」仍为 planned 占位，未实现专属页面。
- BOSS 作为发薪对象的工资/应付/流水/成本归集：GAP-WEB-006（员工工资 L2）边界内。
- 生产环境：未触及。
