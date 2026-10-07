# Marketer 本人客户工作面 G3

> 批次：`WEB-BATCH6-MARKETER-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：本人客户跟进写入、量房安排入口、设计与项目只读 真实账号 PASS
> 日期：2026-10-07
> 上游：`DEC-009`、`DEC-033`、`DEC-034`、`BR-001`

## 1. 范围

- 业务员：`19900000004`（黄贤杰，emp `1790000000000000104`）。
- 新增页面：`/workbench/my-customers`（`MarketerCustomerView.vue`），角色 `Boss / Marketer`。
- Provider：`customer/customer/page`、`customer/customer-follow/page|save`、`customer/customer/measure`、`design/scheme/page`、`project/project/page`。
- 深链接修复：`customer.followup`、`designer.measure` 对业务员指向 `/workbench/my-customers`（原指向 Designer 专属页）。

## 2. 页面能力

- 本人客户列表（Self 范围），显示阶段、设计师、预算、最近跟进。
- 写跟进抽屉：方式（电话/微信/到店/视频/其他）+ 内容 + 下次跟进时间。
- 安排量房抽屉：显式选择 `activeProperty` + 量房时间（仅当阶段为跟进中/待量房可点）。
- 设计与项目只读抽屉：本人客户设计方案、项目进度、跟进时间线；无任何写入口。

## 3. 真实账号验证

正向：

```text
customer/customer/page        -> 本合同 Business 内 50 条，owner 全部为黄贤杰（Self 范围）
UI 写跟进（王芳 演示01）      -> 生成 followId 233378905652723712（随后回滚）
设计与项目抽屉（张敏 演示03） -> 设计（只读）/项目（只读）/跟进记录 正常渲染
customer/customer/measure     -> 已量房屋重复预约 -> 400 该房屋已完成量房，不能重复预约
```

反向（沿用 G1 证据，本页无对应写入口）：

```text
指派设计师 / 负责人变更 / 财务读写 / 项目写 / 主材选材写 -> 拒绝
```

## 4. 清理

```text
探测 followId 233378905652723712 已删除；王芳跟进记录回到 0
未重置凭证（使用既有本地测试账号）
```

## 5. 未覆盖

- 量房结论录入：`GAP-WEB-012` 待 `REQ-BIZ-20261007-018` 裁决，本页不提供入口。
- 量房「安排」正向：测试企业内本人客户房屋均已量房，重复预约被正确拒绝；未构造全新客户+房屋。
- 报价/合同只读字段范围未单独冻结，本批只读既有投影。
- 生产环境：未触及。
