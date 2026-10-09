# 设计师我的业绩重构 · 本地真实数据验收

- 日期：2026-10-10
- 批次：`DESIGNER-PERFORMANCE-REFACTOR-20261010`
- 页面：`/designer/performance`
- 环境：Web Vite `http://127.0.0.1:8080`，本地后端 `http://127.0.0.1:8090`
- 账号：设计师 `19900000005`（董夏鹏）
- 事实源：`statistic/workbench/designer/report`
- 业务边界：不新增 API，不在页面重算正式指标，不展示成本、毛利、利润

## 本轮完成

1. 移除客户、房屋、报价、项目全量列表加载和前端漏斗计算。
2. 本月概览改为服务端 summary：在途客户、本月报价金额、本月签约金额。
3. 环比只消费服务端 changeRate/comparisonState/comparisonLabel，无基期显示“暂无基期”。
4. 新增服务端本月签约额排名：本人名次、团队均值、差额、前 5 名摘要，样本 &lt;3 显示仅供参考。
5. 方案报价主链改为服务端 pipeline，量房 → 设计 → 报价 → 合同。
6. 近 30 天趋势改为服务端 `designer.businessTrend`。
7. 当前工作分布改为服务端 `designer.workDistribution` 主数量。
8. 页面不再出现成本、毛利、利润字段。

## 真实数据

| 指标 | 值 | 结果 |
| --- | ---: | --- |
| 在途客户 | 16 | PASS |
| 本月报价金额 | ¥308,287.51 | PASS，较上月 -32.84% |
| 本月签约金额 | ¥242,012.88 | PASS，较上月 +37.88% |
| 本月签约额排名 | 第 1 名 / 2 位设计师 | PASS，样本 &lt;3 显示仅供参考 |
| 团队均值 | ¥139,212.47 | PASS |
| 对比团队均值 | +¥102,800.41 | PASS |
| 主链量房 | 1 套待处理 | PASS |
| 主链设计 | 15 套待处理 | PASS |
| 主链报价 | 10 份待处理 | PASS |
| 主链合同 | 2 份待交接 | PASS |

## 浏览器与门禁

- `/designer/performance` 真实登录访问 PASS。
- 1440×900 页高比 `1.40`，排名/重点动作与趋势/工作分布同屏组织。
- 1280×800 / 1024×768 无横向溢出。
- 页面网络请求只调用 `statistic/workbench/designer/report`，未调用客户、报价、项目全量列表。
- 页面控制台 0 error。
- `npm run type-check` PASS。
- `npm run build` PASS。
- 状态、动作、权限、工作空间门禁 PASS。

## 截图

- `output/playwright/designer-project-site-20261010/designer-performance-ranked-1440.png`
- `output/playwright/designer-project-site-20261010/designer-performance-ranked-1280.png`
- `output/playwright/designer-project-site-20261010/designer-performance-ranked-1024.png`

## 未做与边界

- 未修改后端 Provider、状态机、权限矩阵、金额和成本利润口径。
- 未展示 `quoteFinalAcceptanceRate`，因为指标注册仍标记为 `mismatch`。
- 未在本页提供明细编辑；处理入口继续落到已有的客户、报价、合同和项目工作台。
