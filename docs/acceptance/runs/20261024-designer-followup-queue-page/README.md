# 2026-10-24 设计师待我跟进队列分页与 App/Web 同源

> 状态：`DEV_VERIFIED / UI_REVIEWED / USER_ACCEPTANCE_PENDING`  
> 范围：设计师「待我跟进」的 20 条服务端分页、关键词/分桶筛选、计数、Web 多分辨率布局和 App 同源入口。  
> 不包含：设计、谈单、签约三页改造、独立验收、正式发布。

## 1. 后端口径

复用同一 Provider：

```text
POST /api/customer/my-customer/overview
```

新增/使用参数：

```json
{
  "current": 1,
  "size": 20,
  "keyword": "客户/手机号/小区",
  "sort": "due",
  "followFilter": "all | overdue | today | soon | unplanned"
}
```

- 待跟进阶段限定为 `New / Following`；
- 已进入量房流程的客户不会混入待跟进队列；
- 关键词、分桶时间条件、排序和分页全部下推后端；
- 新增 `followCounts`：全部待办、已逾期、今日跟进、3 天内、未安排；
- 计数使用 SQL 聚合，不是当前页局部计数；
- 每页默认 20，最多 100。

真实接口结果：

| 请求 | 结果 |
| --- | --- |
| `followFilter=all` | 200；1 条；total=1；计数 all=1 / unplanned=1 |
| `followFilter=overdue` | 200；0 条 |
| `followFilter=today` | 200；0 条 |
| `followFilter=soon` | 200；0 条 |
| `followFilter=unplanned` | 200；1 条 |
| 不存在关键词 | 200；0 条 |
| 第 2 页 | 200；0 条；total 保持 1 |

10 次接口采样：中位 `32.5ms`，P95 `64.2ms`，响应约 `3.6KB`。

## 2. Web

- 原固定 `size=100` 已改为每页 20；
- 增加总数、页码、上一页/下一页；
- 搜索与分桶筛选会回到第 1 页并重新请求；
- 筛选按钮显示服务端聚合计数；
- 移除了中栏重复“写跟进”主行动，保留右栏唯一主行动；
- 1280 时右栏引导上移，1024 时引导排到队列和正文之前；
- 页面只保留一个纵向页面滚动上下文，无横向溢出。

| 分辨率 | 主行动 y | 首屏可见 | 横向溢出 |
| --- | ---: | --- | --- |
| 1920×1080 | 485 | 是 | 无 |
| 1440×900 | 485 | 是 | 无 |
| 1280×800 | 437 | 是 | 无 |
| 1024×768 | 482 | 是 | 无 |

截图：

- `output/playwright/designer-five-stage-audit-20261024/followup-v2-1920x1080.png`
- `followup-v2-1440x900.png`
- `followup-v2-1280x800.png`
- `followup-v2-1024x768.png`

## 3. App

已完成：

- 设计师首页新增「待我跟进」快捷入口；
- 新增页面 `subpackages/customer/pages/designer-followup-workbench`；
- App/Web 共用 `customer/my-customer/overview`；
- App 支持服务端搜索、分桶筛选和 20 条分页；
- 列表展示阶段、风险原因、下次跟进、最近沟通、建议和计数；
- 主行动统一为「写跟进」，直接进入现有跟进表单；
- 拨打电话为次行动；
- 点击卡片进入客户档案。

微信开发者工具实测：

- 首页同时存在「待我跟进」「待我量房」入口；
- 进入待我跟进后显示真实客户 `待完善-136****2182`；
- 分桶为「未安排」，计数 all=1 / unplanned=1；
- 搜索不存在关键词显示真实空态；
- 「未安排」筛选命中该客户；
- 点击「写跟进」进入 `subpackages/customer/pages/follow`。

截图：

- App 首页：`/Users/zhangwei/FutureFiles/安徽昭青/家装装修/装客宝/前端代码/th4-decoboon-app/output/playwright/20261024-designer-stage-queues-audit/designer-home-with-followup-measure-entry.png`
- App 待我跟进：`/Users/zhangwei/FutureFiles/安徽昭青/家装装修/装客宝/前端代码/th4-decoboon-app/output/playwright/20261024-designer-stage-queues-audit/designer-followup-workbench.png`

## 4. 验证

- 后端 `MyCustomerOverviewContextTest`、Dormant、量房状态与量房分页测试：PASS；
- Web `npm run build`：PASS；
- Web `check:workbenches / permissions / workspaces`：PASS；
- App `build:mp-weixin:release`：PASS；
- App `check:subpackages / navigation / ui / client-copy`：PASS；
- Web 页面 Console：0 error；
- App 原生页面进入、搜索、筛选、主行动跳转：PASS。

## 5. 后续

按同一模式继续待我设计、待我谈单、待我签约；设计页还需要优先解决 1280 内容挤压和方案横向滚动。
