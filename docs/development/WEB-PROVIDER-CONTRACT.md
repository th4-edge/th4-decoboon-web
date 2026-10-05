# 装得清 Web V3 与后端 Provider 契约

> 后端规范见 `th4-decoboon/AGENTS.md` 与 `rules.md`。本文件只说明前端消费契约，不改动后端。

## 1. 传输约定

- 统一响应信封：`{ success: boolean, data: T, errorCode?: { code, message, system } }`。
- 认证头为 `token`（非 `Authorization: Bearer`）。
- 请求体默认为 JSON；Provider 的 `LocalDateTime` 使用 ISO 分隔符（`T`）。

## 2. 领域模型

- 后端「服务 = Provider」，入参即领域实体，无 DTO；前端同样不为响应另建 DTO。
- 关联保持对象形态（如 `employee.company`、`employee.store`），不要扁平化为 `companyId`。
- 枚举序列化为 `{ key, value, name }`；前端只读 `value` 做判断，展示 `name`。

## 3. 权限

- 企业/门店/团队/角色/数据范围只来自 `auth/session/info`。
- 前端不得信任或透传 `companyId / empId / ownerId`。
- 菜单隐藏、路由守卫、接口拒绝三层缺一不可；服务端仍强制校验。

## 4. 金额与完成态

- 金额、成本、利润、计数一律由服务端返回，前端不做业务计算。
- `costComplete=false` 时利润/毛利率返回 `null`，前端显示「成本未完整」。
- 完成态由服务端领域事实推导；接口异常时前端显示「暂不可确认」并保留恢复路径。

## 5. 跨端兼容

- 共享后端只做向后兼容的加法：不得改变 App 已依赖的路由、参数、字段语义、状态机与金额口径。
- Web 需要新字段时先确认 App 不受影响；冲突时以 App 线上稳定优先。
