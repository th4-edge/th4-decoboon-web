# Web 业务状态引导组件与接入规范

> 状态：生效并强制执行（2026-10-09）  
> 适用范围：客户经营、客户 360、报价、合同、项目、材料、增减项等所有带状态和下一步动作的页面
> 动作按钮的**样式、文案规范与语义色**另见《WEB-工作台设计构建规范》§6.6（统一 `WorkbenchQuickAction`）。  
> 上位依据：`WEB-业务状态机与闭环一致性规范.md`、`WEB-业务动作与闭环注册规范.md`、`WEB-沉浸式对象工作空间规范.md`、`WEB-场景驱动工作台与多起点导航规范.md`  
> 业务依据：`ANS-BIZ-20261009-002`、`T12-BIZ-20261009-005`、`DEC-002`、`DEC-033`、`DEC-034`、`DEC-042`、`BR-029`、`BR-030`、`BR-036`

---

## 1. 目标

统一 Web 中“当前状态是什么、下一步做什么、为什么、谁负责、缺什么、做完后去哪里”的表达方式，但不新增任何业务状态机。

本规范解决：

- 客户卡片、客户 360、工作台和详情页状态中文不一致；
- 前端自行根据 `status/stage` 推导下一步；
- 主按钮、阻断原因、责任人和回读范围分散在页面；
- 未登记状态显示英文枚举；
- 动作完成后不知道下一步谁处理。

本规范不解决：

- 新状态、新动作和新权限；
- 后端接口实现；
- 金额、成本、利润、收款、结算口径；
- 绕过 `allowedActions` 的前端兜底。

## 2. 三层职责

```text
服务端事实 / 状态视图 / 动作策略
  -> Web 状态适配层
  -> 通用状态引导组件
  -> 页面业务工作面
```

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| 服务端 | 当前状态、允许动作、前置条件、阻断、责任人、目标状态、`reloadScopes` | 视觉排版 |
| Web 状态适配层 | 状态注册解析、动作视图类型、对象适配器、路由映射 | 业务状态和动作裁决 |
| 通用组件 | 状态标签、主行动、对象轨道、阻断原因、状态历史、完成交接 | 现场业务表单、金额计算、权限判断 |
| 业务工作面 | 领域字段、表单、抽屉、全屏编辑和批量操作 | 自造第二套状态和下一步 |

## 3. 核心类型

```ts
interface BusinessNextAction {
  key: string
  label: string
  hint?: string
  ownerRole?: string
  route?: string
  fromStatus?: string
  toStatus?: string
  enabled?: boolean
  blockedReasons?: string[]
  missingFields?: string[]
  reloadScopes?: string[]
  businessRefs?: string[]
}

interface BusinessStateView {
  objectKey: string
  objectId: string
  status: string
  statusLabel?: string
  statusTone?: StatusTone
  derivedLabels?: Array<{ key: string; label: string; tone?: StatusTone }>
  nextAction?: BusinessNextAction | null
  blockedReasons?: string[]
  nextOwner?: string
  revision?: string
  updatedAt?: string
  businessRefs?: string[]
}
```

服务端未提供完整 `BusinessStateView` 时，页面可以使用渐进适配器，但适配器只能转换已有事实，不得生成新的业务动作。

## 4. 标准组件

| 组件 | 使用场景 | 必须展示 | 不得包含 |
| --- | --- | --- | --- |
| `BusinessStateTag` | 状态标签 | 对象、状态键、中文标签、色调 | 业务动作、裸英文、未登记状态猜测 |
| `ObjectStateHeader` | 详情页顶部 | 对象身份、状态、负责人、更新时间、关键事实 | 金额计算、业务表单 |
| `NextActionPanel` | 卡片紧凑态、详情完整态 | 主行动、原因、责任人、缺失、阻断、完成后状态、按钮 | 前端重算 `nextAction` |
| `StateJourney` | 客户/项目阶段轨道 | 真实对象投影、当前节点、终态、异常分支 | 固定写死企业阶段、混合客户与房屋状态 |
| `BlockedReasonNotice` | 阻断提示 | 不能推进的原因、恢复路径 | 权限之外的主按钮 |
| `StateHistoryTimeline` | 状态历史 | 原状态、新状态、操作人、时间、原因 | 只有状态没有操作事实 |
| `CompletionHandoff` | 动作完成 | 已完成结果、下游对象、接棒人、下一步 | 自动切换下一个对象 |

## 5. 页面接入规则

### 5.1 列表卡片

客户卡片等列表卡片使用紧凑态：

```text
对象名称 + 状态标签
关键业务事实
当前主行动
风险 / 阻断
点击进入对象工作空间
```

卡片不得展开完整表单，不得显示多个同级主按钮。

### 5.2 详情页

详情页固定顺序：

```text
ObjectStateHeader
-> StateJourney
-> NextActionPanel
-> BlockedReasonNotice（如有阻断）
-> 当前业务工作面
-> StateHistoryTimeline
-> CompletionHandoff（动作完成后）
```

### 5.3 唯一主行动

- 每个状态最多一个视觉最重的主行动。
- 未返回 `allowedActions` 或 `nextAction` 时，主按钮禁用并显示“待业务确认”。
- 权限、金额、合同生效、选材门禁等高危判断必须由服务端完成。
- 动作成功后按 `reloadScopes` 回读；回读失败显示“部分数据暂不可确认”。

## 6. 状态标签规则

1. 使用 `BusinessStateTag`，优先传 `objectKey + statusKey/serverValue`。
2. 状态中文来自 `docs/standards/business-state-machines.json`。
3. 未登记状态显示“待业务确认”，不得显示 `PendingSign`、`effective` 等裸值。
4. 同一状态在列表、详情、侧栏、抽屉和导出中中文一致。
5. 状态不能只靠颜色表达，必须同时有文字。

## 7. 禁止事项

1. 在页面写 `if (status === 'xxx') return '下一步...'`。
2. 在卡片、详情、工作台维护不同状态中文映射。
3. 前端把 `stage` 直接当业务动作依据。
4. 用空值、`0` 或旧数据伪装动态状态完成。
5. 未经服务端动作策略显示可点击主按钮。
6. 组件直接读取成本、利润或敏感字段。
7. 多房屋客户不显示或丢失 `activePropertyId`。

## 8. 自动检查与验收

开发涉及状态引导时至少运行：

```bash
npm run check:states
npm run check:actions
npm run check:workspaces
npm run type-check
npm run build
```

验收必须覆盖：

- 同一对象在列表、详情、工作台显示同一状态和主行动；
- 未登记状态显示“待业务确认”；
- 无权限或前置不满足时主按钮禁用并有原因；
- 动作完成后关联对象、责任人和下一步已回读；
- 多房屋客户必须验证当前房屋上下文；
- App / Web 同事实一致，布局可以不同。
