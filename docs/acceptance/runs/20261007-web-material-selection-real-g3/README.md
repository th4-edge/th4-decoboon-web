# Web 主材选材真实账号 G3

> 批次：`WEB-BATCH2-PM-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：Designer 真实写入与回滚 PASS；StoreManager/Finance 真实只读 PASS
> 日期：2026-10-07

## 范围

- 本地测试企业真实选材和材料计划。
- Designer 真实客户确认登记。
- StoreManager、Finance 真实页面访问与维护入口可见。
- Pm 路由拒绝由路由守卫和 mock 会话验证。
- 写操作后恢复原选材行、材料计划行和凭证哈希。

## Designer 真实写入

项目：

`228669029517099008`

选材：

`231286742978658304`

材料计划：

`228669029559042048`

操作前：

```text
选材状态：PendingConfirm
确认人：NULL
材料计划选材：228677421413433344
```

操作后：

```text
选材状态：Confirmed
确认人：G3客户确认
材料计划选材：231286742978658304
```

随后已恢复：

```text
选材状态：PendingConfirm
确认人：NULL
材料计划选材：228677413341343344
```

临时 Designer 口令恢复后返回 `AUTH_FAILED`。

## StoreManager / Finance 只读

真实账号访问 `/workbench/materials/228669029517099008`：

- 页面标题：主材选材工作区
- 保存草稿入口：1
- 登记客户确认入口：1
- 无横向溢出
- 未执行写入

临时口令均已恢复并返回 `AUTH_FAILED`。

## 证据

- `output/playwright/material-selection-real/material-selection-1440.png`
- `output/playwright/material-selection-real/material-selection-1280.png`
- `output/playwright/material-selection-real/material-selection-1024.png`

## 未覆盖

- Boss 真实写入。
- Pm/TeamLeader 真实接口拒绝，仅验证路由拒绝和后端单元/全量测试。
- 采购锁定与客户确认并发。
- 客户本人登录确认；当前为内部客户确认事实代登记。
- 生产环境发布。

## 结论

`REAL_ACCOUNT_G3_PARTIAL_PASS`。主材选材页面的核心写入事实、材料计划联动和角色页面入口已通过本地真实链路验证并回滚，但不能替代生产验收。
