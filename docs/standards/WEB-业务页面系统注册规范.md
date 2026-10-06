# Web 业务页面系统注册规范

> 状态：生效并强制执行  
> 适用范围：页面状态、字段格式、页面任务、组件行为、验收场景和自动门禁  
> 上位依据：业务概念、状态机、动作、指标、权限五层注册规范

---

## 1. 统一原则

页面不是字段集合，而是业务任务执行界面。页面必须同时满足：

```text
当前事实清楚
-> 下一步明确
-> 责任角色明确
-> 阻断原因可解释
-> 空/失败/无权限/过期/部分确认完整
-> 组件行为一致
-> 验收场景可复现
```

任何页面不得自行定义业务状态、金额公式、权限规则或验收口径。

---

## 2. 页面状态注册

机器可读文件：

```text
docs/standards/business-page-states.json
```

必须覆盖：

| 状态 | 含义 | 最低要求 |
| --- | --- | --- |
| loading | 正在加载 | 骨架或进度反馈，不显示旧值冒充当前值 |
| empty | 真实为空 | 说明为什么为空、下一步怎么做 |
| error | 服务端失败 | 显示原因、保留上下文、提供重试 |
| unauthorized | 无权限 | 明确权限边界和返回路径 |
| expired | 会话/数据过期 | 引导重新登录或刷新，保留可恢复输入 |
| partial | 部分确认 | 标出未加载部分，不得显示完整成功 |
| stale | 数据已过期/版本冲突 | 提示重新加载，禁止覆盖新版本 |
| success | 成功 | 显示新状态、责任人、关联刷新结果 |

页面必须有 `stateKey -> UI -> copy -> action -> evidence` 的完整映射。

---

## 3. 字段格式注册

机器可读文件：

```text
docs/standards/business-field-formats.json
```

字段格式覆盖：

- 金额；
- 比例；
- 数量；
- 日期；
- 日期时间；
- 枚举；
- 状态；
- 长文本；
- 电话；
- 身份证；
- 银行卡；
- 交易号；
- 时长；
- 布尔和未确认值。

规则：

- 金额统一使用 `MoneyText/formatMoney`；
- 比例统一使用 `formatPercent`；
- 日期时间统一使用服务端格式化或 `formatDateTime`；
- 枚举必须使用 META 中文；
- 脱敏字段不得在普通列表展开原始值；
- 长文本必须处理换行、折叠和复制；
- 缺失值显示“暂不可确认”，不得自动显示为 0。

---

## 4. 页面任务注册

机器可读文件：

```text
docs/standards/business-page-tasks.json
```

每个页面任务必须声明：

- `key`；
- `page`；
- `role`；
- `object`；
- `currentFact`；
- `nextAction`；
- `actionPolicyKey`；
- `ownerRole`；
- `blockers`；
- `emptyReason`；
- `stateMachineKey`；
- `acceptanceScenarios`。

页面任务不得把“下一动作”交给用户自己寻找。

---

## 5. 组件行为注册

机器可读文件：

```text
docs/standards/business-component-behaviors.json
```

组件类型包括：

- 业务选择器；
- 表单/单据；
- 抽屉/弹窗；
- 表格；
- 上传组件；
- 状态标签；
- 动作按钮；
- 异步数据壳层。

每个组件类型必须声明：

- 打开/关闭；
- loading；
- retry；
- clear；
- context change；
- stale/expired；
- failure recovery；
- keyboard/accessibility；
- 是否允许本地缓存。

---

## 6. 验收场景注册

机器可读文件：

```text
docs/standards/business-acceptance-scenarios.json
```

每个关键业务动作至少覆盖：

```text
normal
rejection
unauthorized
concurrent
closure
```

验收场景必须声明：

- 前置数据；
- 操作步骤；
- 断言；
- 关联对象；
- 证据；
- 清理方式；
- 是否允许生产写入。

只截图页面，不验证回读和关联状态，不算闭环验收。

---

## 7. 自动门禁

新增命令：

```bash
npm run check:page-system
```

检查：

- 五类注册表字段完整；
- 页面任务引用有效业务概念、状态机和动作；
- 组件行为覆盖 loading/retry/clear/context/stale/failure；
- 验收场景覆盖 normal/rejection/unauthorized/concurrent/closure；
- 页面状态不得遗漏部分确认、无权限、过期和失败；
- 引用不存在的动作、状态、权限或页面任务必须失败。

---

## 8. 交付定义

- [ ] 页面状态完整；
- [ ] 字段格式统一；
- [ ] 页面任务明确当前事实、下一步、责任角色和阻断原因；
- [ ] 组件行为统一；
- [ ] 验收覆盖正常、拒绝、越权、并发和闭环；
- [ ] `npm run check:page-system` 通过；
- [ ] 真实浏览器和关联对象回读通过。
