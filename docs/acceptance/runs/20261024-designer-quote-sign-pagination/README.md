# 2026-10-24 设计师待我谈单 / 待我签约分页与加载方式统一

> 状态：`DEV_VERIFIED / UI_REVIEWED / USER_ACCEPTANCE_PENDING`  
> 范围：谈单和签约的数据库分页、Web 分页组件、App 触底加载更多、筛选/总数一致。  
> 不包含：独立验收、正式发布。

## 1. 后端分页

### 待我谈单

`statistic/workbench/quote/page` 已使用 `findWorkbenchQuoteIds`：

- SQL 完成租户、角色、Dormant、状态、关键词和深链过滤；
- SQL 排序并返回当前页报价 ID；
- 再批量读取当前页报价、客户和房屋；
- 不再全量读取活动报价后内存分页。

### 待我签约

`statistic/workbench/sign/page` 本轮改为 SQL 锚点分页：

- SQL 按 Accepted/Converted、Dormant、角色范围、关键词、合同状态、项目状态过滤；
- SQL 排序并返回当前页报价 ID；
- 再批量读取当前页报价、合同和项目；
- 支持 Web 和 App 两套筛选 key；
- 不再全量读取报价与合同后内存筛选分页。

## 2. Web 分页组件

谈单和签约左栏均改为 Element Plus `el-pagination`：

```text
上一页 / 页码 / 下一页
每页 20 条
总数显示在组件旁
```

实测数据：

| 页面 | 第 1 页 | 第 2 页 | 总数 |
| --- | ---: | ---: | ---: |
| 待我谈单 | 20 | 6 | 26 |
| 待我签约 | 20 | 7 | 27 |

点击第 2 页后：

- 页面发出 `current=2,size=20`；
- 列表分别显示 6/7 条；
- 分页组件活动页为 2；
- 1920/1440/1280/1024 无页面级横向溢出；
- Console error 为 0。

证据：

- `quote-pagination-page2-1440.png`
- `sign-pagination-page2-1440.png`

## 3. App 统一下拉刷新与触底加载

App 五个设计师队列统一为同一列表行为：

- 顶部下拉刷新第 1 页；
- `onReachBottom` 触底自动加载下一页；
- 新页数据去重后追加；
- `ListFooter` 只显示加载中、失败重试和“没有更多了”；
- 已移除所有“上一页 / 下一页 / 第 x/y 页 / 总页数”控件。

覆盖页面：

- 待我跟进；
- 待我量房；
- 待我设计；
- 待我报价；
- 合同签约。

真实测试：

| 页面 | 首次加载 | 触底后 | 结果 |
| --- | ---: | ---: | --- |
| 待我报价 | 20 | 26 | 自动追加第 2 页，显示“没有更多了” |
| 合同签约 | 20 | 27 | 自动追加第 2 页，显示“没有更多了” |

App 签约摘要同步改为“已加载待签约 / 已加载履约中”，避免把已加载累计误写成全量经营指标。

证据：

- `designer-quote-infinite-scroll-loaded.png`
- `designer-sign-infinite-scroll-loaded.png`

## 4. 测试数据与清理

为验证分页，临时新增：

- 25 条 Draft 报价；
- 25 条 Accepted 报价；
- 使用固定 ID `990000000009100001~990000000009200025`；
- 分页验证后已删除报价及关联 Notice；
- 清理复验：临时报价 0 条，当前恢复为谈单 1 条、签约 2 条。

## 5. 验证

- 后端谈单/签约分页单元测试与 205 行分页测试：PASS；
- Web build、pagination、workbenches、permissions、workspaces：PASS；
- App release build、分包、导航、UI、文案门禁：PASS；
- Web 第 2 页点击、App onReachBottom：PASS；
- Web Console error：0。
