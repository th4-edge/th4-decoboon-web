# Web Pm 验收页面业主决策 API 模拟

> 批次：`WEB-BATCH2-PM-20261007`
> 类型：`API_SIMULATED`
> 状态：Pm 页面待确认、驳回复验、已通过状态行为通过
> 日期：2026-10-07

## 说明

当前没有可用业主微信会话，本轮不冒充业主页面验收。业主义务由后端
`OwnerClosureAcceptanceTest` 真实回归验证，Web Pm 页面使用模拟业主决策响应验证状态呈现和复验提交契约。

## 后端真实回归

测试类：

`OwnerClosureAcceptanceTest`

结果：

```text
Tests run: 24, Failures: 0, Errors: 0, Skipped: 0
```

覆盖业主确认、驳回、重复决策、冲突决策、整改轮次和幂等。

## Web API 模拟场景

### 待业主确认

页面显示：

```text
等待业主本人确认或驳回。
```

Pm 没有确认或驳回入口。

### 业主驳回

页面显示：

```text
按业主驳回问题整改后提交复验。
```

Pm 可打开“提交复验”，并且必须填写：

- 验收说明
- 整改说明
- 整改后照片

模拟复验提交 payload：

```json
{
  "stageId": "s1",
  "result": "pass",
  "content": "整改后复验说明",
  "images": ["project/acceptance/proof.png"],
  "rectificationNote": "已按要求整改并复检",
  "rectificationImages": ["project/acceptance/proof.png"]
}
```

### 业主已确认

页面显示：

```text
阶段验收已确认，进入下一阶段。
```

Pm 不再拥有提交验收或复验入口。

## 未覆盖

- 业主本人微信页面操作。
- 业主真实会话确认和驳回。
- 真实驳回后复验轮次的端到端写入。
- 生产环境。
