# Boss 一人装企岗位视角与经营/组织页面 G3

> 批次：`WEB-BATCH7-BOSS-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：岗位视角（只切上下文）、经营总览、组织效能 真实 BOSS 账号 PASS
> 日期：2026-10-07
> 上游：`DEC-032`、`BR-028`、`BR-030`

## 1. 新增能力

- **一人装企岗位视角**（`WorkbenchHomeView.vue`，仅 BOSS）：负责人/店长/团队负责人/业务员/设计师/项目经理/财务七种视角；切换后只替换工作台入口集合与深链接，**身份、数据范围（Company）、审计主体不变**，并在界面明示。
- **经营总览** `/workbench/overview`（`BossOverviewView.vue`）：`statistic/boss/business/report`（漏斗、报价转化、渠道、区域、订单分档）。
- **组织效能** `/workbench/organization`（`BossOrganizationView.vue`）：`statistic/organization/report`（在职人数、人均产出/订单、角色产能、设计师/业务员/项目经理排行、样本是否充分）。
- **管理导航接通**：经营总览 / 业务分析 → `/workbench/overview`；组织效能 → `/workbench/organization`（原为 planned）。

## 2. 真实 BOSS 验证（张伟 `19900000001`）

```text
/workbench                  -> 出现「岗位视角」切换（含身份/范围/审计说明）
切换「设计师视角」          -> 入口卡片切换为设计师工作面（待我报价 / 待我量房 …）
/workbench/overview         -> 经营漏斗 / 报价转化 / 渠道结构 / 区域与订单结构 渲染
/workbench/organization     -> 在职人数 / 人均产出 / 角色产能 / 三类排行 渲染
```

权限边界（非 BOSS 拒绝）：

```text
Marketer  -> statistic/organization/report      403 当前账号无权执行该操作
Marketer  -> statistic/boss/business/report     403 当前账号无权执行该操作
Designer  -> statistic/organization/report      403
Designer  -> statistic/boss/business/report     403
Boss      -> 两个报表均正常返回 Company 数据
```

## 3. 环境说明

执行期间本地 8090 实例曾停止（jar 被清理），已用 `mvn -o spring-boot:run -Dspring-boot.run.profiles=dev`（JDK 23）重新拉起后完成本 G3；该实例来自主仓库构建，不含工作树提交。

## 4. 未覆盖

- 一人装企「制单→确认→发放→台账→工资条」全链：需在 G3 之外单独构造工资闭环数据，本轮未执行。
- 项目管理导航「项目监管」仍为 planned。
- 岗位视角的审计留痕（记录“以何视角查看”）当前仅界面明示，后端未落审计字段；如需强制留痕需业务裁决。
- 生产环境：未触及。
