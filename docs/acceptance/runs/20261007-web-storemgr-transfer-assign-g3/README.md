# StoreManager 本店转交/指派 G3

> 批次：`WEB-BATCH4-STOREMANAGER-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：店长本店客户列表、转交负责人、指派设计师 UI 与 API 真实写入并回滚 PASS
> 日期：2026-10-07
> 上游：`ANS-BIZ-20261007-023`、`T12-BIZ-20261007-006`、`DEC-034`、`BR-030`

## 1. 范围

- 店长账号：`19900000003`（王洪文，emp `1790000000000000103`，store `1790000000000000002`）。
- 新增页面：`/workbench/customers`（`StoreCustomerView.vue`），角色 `Boss / StoreManager`。
- Provider：`customer/customer/page`、`customer/customer/update`（owner-change）、`customer/customer/handoff`（designer-handoff）、`user/employee/page`（本店员工范围）、`property/property/page`（activeProperty）。
- 员工范围：店长经 `user/employee/page` 仅返回本门店员工；候选负责人过滤为业务员/设计师/团队负责人/店长/企业负责人；候选设计师过滤为设计师/企业负责人。

## 2. 正向

### 转交客户负责人

客户 `232960730997981184`（诊断客户A，原负责人 黄贤杰 Marketer）：

```text
customer/customer/update {customerId, ownerId=谢玲玲(0106)}
结果：emp_id 0104 -> 0106（门店快照保持本店）
```

Web 实测：页面「转交负责人」抽屉选择「谢玲玲 · 设计师」→ 确认转交 → DB `emp_id=0106`。

### 指派设计师

客户 `232960420686594048`（荷塘家园-陈先生，施工中，原设计师 董夏鹏 0105）：

```text
customer/customer/handoff {customerId, propertyId=232961774796668928, designerId=谢玲玲(0106)}
结果：designer_id 0105 -> 0106，handed_off_at 刷新
```

Web 实测：页面「指派设计师」→ 显式选择 activeProperty（房屋 3栋1202）→ 选择「谢玲玲 · 设计师」→ 确认指派 → DB `designer_id=0106`。

## 3. 反向

```text
对 New 客户指派设计师 -> 400 客户尚未跟进或已流失，不能指定设计师
转交给不存在/离职负责人 -> 400 负责人不属于当前企业或已离职
```

## 4. 清理

```text
客户 232960730997981184：emp_id 还原 0104
客户 232960420686594048：designer_id 还原 0105，handed_off_at 还原
店长口令：已还原，临时口令返回 AUTH_FAILED
```

## 5. 未覆盖 / 缺口

- 跨门店负向：本地测试企业仅单门店，无法构造跨店员工；后端 `CustomerContext.resolveAssignableOwner` 店长限本店、`Handoff` 店长限本店设计师，逻辑已具备。
- **`GAP-WEB-010`（OPEN）**：`customer/owner-change` 动作要求「必须明确变更原因」，但后端 `customer/customer/update` 无 `reason` 入参、无独立审计留痕，当前转交只更新 owner，未落原因。
- 指派/转交的版本冲突（对象版本）未在 UI 暴露：动作注册表要求记录「对象版本」，后端未返回该字段。
- 生产环境：未触及。
