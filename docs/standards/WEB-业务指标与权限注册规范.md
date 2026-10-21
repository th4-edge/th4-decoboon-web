# Web 业务指标与权限注册规范

> 状态：生效并强制执行  
> 适用范围：经营指标、财务指标、角色数据范围、动作权限、敏感字段和相关页面展示  
> 上位依据：装得清业务智能体 `MET/BR/DEC` 与后端权限规则

---

## 1. 指标注册

机器可读文件：

```text
docs/standards/business-metric-definitions.json
```

每个指标必须声明：

| 字段 | 含义 |
| --- | --- |
| `key` | 稳定指标键 |
| `label` | 业务中文名 |
| `formula` | 正式公式或明确说明 |
| `numerator` | 分子口径 |
| `denominator` | 分母口径 |
| `unit` | amount/percent/count/ratio/boolean |
| `aggregation` | sum/ratio/latest 等 |
| `window` | 时间范围 |
| `dimensions` | 可下钻维度 |
| `filters` | 统计前过滤 |
| `exclusions` | 明确排除项 |
| `missingValue` | null/0/not_applicable 及展示 |
| `display` | 展示格式 |
| `source` | 业务事实源 |
| `businessRefs` | MET/BR/DEC 编号 |
| `implementationStatus` | implemented/mismatch/pending |

规则：

- 页面不得自己定义公式；
- 指标数值必须来自后端标准 `report/summary` 接口，不得从列表、当前页或前端聚合计算；列表与汇总契约见 `docs/standards/WEB-列表分页与汇总数据规范.md`；
- 成本不完整时利润和毛利率必须为 `null`，展示“成本不完整”；
- 分子、分母、排除项和时间口径必须显示或可追溯；
- 未裁决指标不得标记 implemented；
- 当前实现与正式口径不一致时必须标记 mismatch。

---

## 2. 权限注册

机器可读文件：

```text
docs/standards/business-permission-policies.json
```

统一数据范围：

```text
Company
Store
Team
Self
ProjectParticipant
ProjectOwner
```

员工角色固定七类：

```text
Boss
StoreManager
TeamLeader
Marketer
Designer
Pm
Finance
```

外部主体只允许显式登记，如 `Owner`。

每个权限策略必须声明：

- 业务对象或能力；
- 允许角色；
- 数据范围；
- Provider；
- 允许/拒绝/脱敏结果；
- 条件；
- 字段敏感级别；
- 业务规则编号。

页面只做可见性，服务端必须重新校验企业、门店、团队、本人、项目和对象归属。

---

## 3. 敏感字段分级

| 级别 | 示例 | 默认处理 |
| --- | --- | --- |
| normal | 项目名称、客户状态 | 按数据范围展示 |
| financial | 合同金额、应收应付、回款 | 财务/Boss/授权店长 |
| cost | 标准成本、采购价、项目成本 | Boss/店长/财务 |
| profit | 毛利、毛利率、经营利润 | 按利润权限展示，成本不完整返回空值 |
| personal | 员工手机号、工资、提成、考勤 | 本人或管理角色，最小字段 |
| sensitive | 身份证、银行卡、工人隐私 | 最小必要角色，必要时脱敏 |

---

## 4. 自动门禁

新增命令：

```bash
npm run check:metrics
npm run check:permissions
```

指标检查：

- 公式和缺失值必须完整；
- 成本/利润指标必须声明 `costComplete` 规则；
- 单位、时间范围、排除项和来源必须有效；
- 分母为零和缺失值不得自动显示为 0；
- mismatch 指标必须保留差异说明。

权限检查：

- 角色和数据范围必须来自固定枚举；
- 动作注册表中的角色和范围必须能在权限注册表中解释；
- 金额、成本、利润和敏感字段必须声明权限边界；
- 页面不得把前端角色判断当成最终权限。

---

## 5. 交付定义

- [ ] 指标已登记公式、分子、分母和时间范围；
- [ ] 缺失值、排除项和成本完整性已声明；
- [ ] 权限策略已登记角色、范围和对象；
- [ ] 动作注册表与权限注册表无冲突；
- [ ] 页面不自行计算正式指标或最终权限；
- [ ] `npm run check:metrics` 和 `npm run check:permissions` 通过；
- [ ] 真实浏览器验证金额、比例、空值和脱敏展示。
