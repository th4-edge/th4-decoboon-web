# 2026-10-24 设计师待我设计队列分页与 App/Web 同源

> 状态：`DEV_VERIFIED / UI_REVIEWED / USER_ACCEPTANCE_PENDING`  
> 范围：设计师「待我设计」的资格口径、数据库分页、关键词/设计状态筛选、Web 多分辨率布局、App 同源入口和 URL 锚点。  
> 不包含：谈单、签约改造、独立验收、正式发布。

## 1. 统一资格口径

`statistic/workbench/design/page` 现在同时服务 Web 与 App，服务端只返回：

- 客户状态为 `New / Following / PendingMeasure / Quoted`；
- 房屋未进入 `Contracted / Serving / Completed`；
- 存在已完成量房记录或房屋最近量房时间；
- 不存在客户已接受或已转项目的正式报价；
- 当前员工有设计责任或数据范围。

这样 App 不再把「未量房」客户混入设计工作台。

## 2. 服务端分页与筛选

请求：

```json
{
  "current": 1,
  "size": 20,
  "keyword": "客户/手机号/小区/房屋",
  "filter": "all | Pending | Doing | Done"
}
```

- `Pending`：尚无方案；
- `Doing`：有方案但均未完成；
- `Done`：至少有一套方案已超出草稿；
- 关键词、设计状态、资格和排序全部下推 SQL；
- 当前页只批量装配房屋、方案、诉求、量房和价格；
- 设计页不再全量读取客户、房屋和设计实体。

真实接口结果：

| 请求 | 结果 |
| --- | --- |
| `filter=all` | 2 条；total=2；林女士 + 张伟 |
| `filter=Pending` | 1 条；林女士；已量房、暂无方案 |
| `filter=Doing` | 0 条 |
| `filter=Done` | 1 条；张伟；2 套方案 |
| 不存在关键词 | 0 条 |
| 第 2 页 | 0 条；total 保持 2 |

10 次接口采样：中位 `32.7ms`，P95 `140.2ms`（首次请求含冷启动），响应约 `1.3KB`。

## 3. Web 页面

- 左栏每页 20 条，增加总数、页码和上下页；
- 搜索与「待设计 / 设计中 / 方案完成」筛选回源服务端；
- 设计页不再在前端按客户阶段筛选；
- 1280 改为左队列 + 右侧顶部引导 + 中栏内容；
- 1024 引导区位于首屏，主行动可直接看到；
- 中栏主行动只保留右栏一个入口；
- 方案卡从横向滚动改为自适应栅格；
- ≤1400 左栏不再建立内部纵向滚动，页面只保留页面级纵向滚动。

| 分辨率 | 主行动 y | 首屏可见 | 方案横向溢出 | 页面横向溢出 |
| --- | ---: | --- | --- | --- |
| 1920×1080 | 532 | 是 | 无 | 无 |
| 1440×900 | 532 | 是 | 无 | 无 |
| 1280×800 | 532 | 是 | 无 | 无 |
| 1024×768 | 684 | 是 | 无 | 无 |

## 4. URL 锚点

- 首次从菜单进入 URL 保持干净：`/designer/design`；
- 不再自动写入 `customerId / activePropertyId / schemeId`；
- 用户显式选择客户或房屋后才写入对象锚点；
- 实测选择林女士后写回：

```text
?customerId=990000000004001001&activePropertyId=990000000004001002
```

存在具体方案时才追加 `schemeId`。

## 5. App

- App 设计工作台改为消费同一分页 Provider；
- 增加服务端搜索、状态筛选和页码；
- 不再本地按当前页过滤；
- 实测显示 2 条：张伟、林女士；
- 两条均有已量房事实，不再出现「未量房」；
- 「待设计」筛选只保留林女士；
- 搜索不存在关键词显示真实空态。

截图：

- `output/playwright/designer-five-stage-audit-20261024/design-v2-1920x1080.png`
- `design-v2-1440x900.png`
- `design-v2-1280x800.png`
- `design-v2-1024x768.png`
- App：`/Users/zhangwei/FutureFiles/安徽昭青/家装装修/装客宝/前端代码/th4-decoboon-app/output/playwright/20261024-designer-stage-queues-audit/designer-design-workbench-v2.png`

## 6. 验证

- 后端设计工作台聚合测试：PASS；
- 后端量房与跟进相关定向测试：PASS；
- Web `npm run build`：PASS；
- Web `check:pagination / workbenches / permissions / workspaces`：PASS；
- App `type-check`、release 构建、分包/导航/UI/文案门禁：PASS；
- Web Console：0 error；
- App 原生页面搜索、筛选、分页：通过。

## 7. 后续

继续待我谈单和待我签约，把列表查询从“全量后内存分页”收口为数据库锚点分页。
