# 2026-10-24 设计师待量房队列分页与工作台首屏

> 状态：`DEV_VERIFIED / UI_REVIEWED / USER_ACCEPTANCE_PENDING`  
> 范围：设计师「待我量房」的查询契约、右侧动作语义、服务端搜索/筛选/分页、Web 多分辨率布局和 App 同源入口。  
> 不包含：跟进/设计/谈单/签约四页改造、独立验收、正式发布。

## 1. 右侧为什么是“安排量房”

该动作不是前端固定文案，而是后端按量房任务状态返回的主行动：

| 业务状态 | 主行动 | 并列动作 |
| --- | --- | --- |
| 未预约量房 | 预约量房 | 无 |
| 已预约、未逾期 | 登记量房结论 | 无 |
| 已预约、超过预约时间 4 小时 | 联系客户改约 | 登记量房结论 |
| 已取消 | 重新安排量房 | 无 |
| 量房完成、未形成方案 | 新建方案 | 无 |

业务依据：`docs/product/2026-10-01-量房工作台产品规格.md` §4.3、§9。未预约时下一步必须是约定上门时间；已预约后主行动才切换为录入量房事实。

原页面问题在于同一动作存在三种措辞：

```text
后端主行动：安排量房
中栏入口：预约量房
下一步说明：约定量房时间
```

本轮统一为：

```text
主行动：预约量房
中栏：预约量房
下一步说明：约定量房时间
```

`安排量房`容易被理解成把任务安排给其他执行人，不符合“设计师同意向确认上门时间”的实际业务动作。

## 2. 后端查询

新增：

```text
POST /api/statistic/designer/measure/page
```

参数：

```json
{
  "current": 1,
  "size": 20,
  "keyword": "客户/手机号/小区/房屋",
  "state": "overdue | today | scheduled | notScheduled | handoff"
}
```

实现：

- SQL 先按企业、客户生命周期、责任人、关键词、量房状态筛选；
- 量房状态由 `db_measure` 聚合事实推导；
- 用稳定的客户/房屋锚点先分页，`Page` 返回真实总数；
- 只对当前页批量读取客户、房屋、量房、诉求和设计；
- 不再读取本人全部客户及其全部关联数据；
- Dormant 客户不在候选状态中；
- `db_measure` 聚合增加企业条件，避免跨租户扫描。

兼容说明：旧 `/statistic/designer/measure/list` 暂时保留，但 Web 已切换到新分页 Provider。

## 3. Web 页面

- 每页 20 条，显示总数和页码；
- 搜索与状态筛选全部回源服务端，切换条件回到第 1 页；
- 搜索、筛选、分页、空态均使用真实服务端结果；
- 中栏不再重复“预约量房”主按钮，唯一主行动保留在右栏；
- `>1400` 三栏；`1025–1400` 左队列 + 右侧顶部引导 + 中栏内容；`≤1024` 引导、队列、工作面依次排列；
- 1024 下首屏即可看到主行动，不再位于 2000px 之后。

## 4. App 同源入口

已完成：

- 设计师首页新增「待我量房」快捷入口；
- 新增 App 页面 `subpackages/customer/pages/designer-measure-workbench`；
- App 与 Web 共用 `statistic/designer/measure/page`；
- App 支持服务端搜索、状态筛选和 20 条分页；
- 卡片直接展示服务端返回的状态、风险原因、下一步、主行动和并列动作；
- 主行动按 key 跳转预约、录入量房、新建方案或客户详情；
- 设计师角色增加 `view:measure-workbench` 页面能力，未放宽后端权限。

微信开发者工具实测：

- 首页「待我量房」入口可达；
- 进入页面后显示林女士任务，状态「量房完成·待交设计」，主行动「新建方案」；
- 搜索不存在的关键词显示真实空态；
- 「待交设计」筛选返回正确任务；
- 点击主行动进入方案列表；
- Console/运行未出现页面异常。

## 5. 真实接口结果

| 请求 | 结果 |
| --- | --- |
| `current=1,size=20` | 200；1 条；total=1；pages=1 |
| `current=2,size=20` | 200；0 条；total=1 |
| `state=missing_property` | 200；0 条 |
| `keyword=ZZZZ-NO-MATCH` | 200；0 条 |
| `keyword=林女士` | 命中林女士量房任务 |
| 10 次分页接口采样 | 中位 26.3ms，P95 44.7ms，响应 1493B |

当前样本是“已预约且逾期”，因此页面正确显示：

```text
主行动：联系客户改约
下一步：录入量房事实
并列动作：登记量房结论
```

未预约场景由单元测试覆盖，服务端返回 `预约量房`。

## 6. 布局结果

| 分辨率 | 主行动 y | 是否首屏可见 | 横向溢出 | Console error |
| --- | ---: | --- | --- | ---: |
| 1920×1080 | 481 | 是 | 无 | 0 |
| 1440×900 | 481 | 是 | 无 | 0 |
| 1280×800 | 459 | 是 | 无 | 0 |
| 1024×768 | 508 | 是 | 无 | 0 |

截图：

- `output/playwright/designer-five-stage-audit-20261024/measure-v2-1920x1080.png`
- `output/playwright/designer-five-stage-audit-20261024/measure-v2-1440x900.png`
- `output/playwright/designer-five-stage-audit-20261024/measure-v2-1280x800.png`
- `output/playwright/designer-five-stage-audit-20261024/measure-v2-1024x768.png`

## 7. 验证

- `mvn test -Dtest=DesignerMeasureTaskContextTest,DesignerMeasureScopeTest,DesignerQueueRoleGateTest,MeasureScheduleFactTest,MeasureStateGuardTest`：PASS；
- 新增分页锚点装配测试：PASS；
- 新增未预约主行动文案测试：PASS；
- `npm run build`：PASS；
- `npm run check:workbenches`：PASS；
- `npm run check:permissions`：PASS；
- `npm run check:workspaces`：PASS；
- Web Console：0 error；
- 页面级横向溢出：无；
- `npm run build:mp-weixin:release`：PASS；
- `npm run check:subpackages`：PASS；
- `npm run check:navigation`：PASS。

## 8. 后续

1. 按同一方法继续改造待我跟进、待我设计、待我谈单、待我签约，避免五页再次各自演化。
2. 后续如需上传体验版，仍按“Codex 只做到体验版，正式提审和发布由用户本人完成”的边界执行。
