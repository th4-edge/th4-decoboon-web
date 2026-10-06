# 我的业绩 · 页面落地与布局冒烟验收

- 日期：2026-10-06
- 批次：`DESIGNER-PERFORMANCE-20261006`
- 页面：`/designer/performance`
- 分辨率：1440×900 / 1280×800 / 1024×768
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`

## 本轮完成

1. 业绩总览：累计签约金额、已签约客户数、项目数。
2. 经营指标：已完工项目、报价接受率、客户转化率。
3. 设计转化漏斗：负责客户 → 完成量房 → 进入设计 → 提交报价 → 签约成交 → 完工交付。
4. 最大流失提示：标出当前漏斗中流失最大的相邻环节。
5. 完工节奏：最近六个月实际 / 计划完工项目数柱状图。
6. 签约与交付明细：客户、房屋、项目编号、状态、合同金额、开工计划、完工计划。
7. 数据截止时间：页面显示本次读取的服务端数据截止点。
8. 边界：只展示本人业绩，不含项目成本、毛利、利润和回款。

## Provider 路由

| 用途 | Provider |
| --- | --- |
| 客户 | `customer/customer/page` |
| 房屋 | `property/property/page` |
| 报价 | `quote/designer/page` |
| 项目 | `project/project/page` |

## 验证结论

| 项 | 结果 |
| --- | --- |
| `npm run type-check` | PASS |
| `npm run build` | PASS |
| `/designer/performance` 三档渲染 | PASS（路由 Mock 数据） |
| 浏览器控制台 | 0 error / 0 warning |
| 漏斗、完工节奏、签约明细渲染 | PASS（路由 Mock 数据） |
| 真实业绩数据与权限边界 | 待真实设计师账号登录后补验 |

## 数据说明

本轮截图使用 Playwright 路由 Mock 提供合成客户、房屋、报价和项目数据，仅用于验证指标口径、漏斗、完工节奏和明细布局。

**这不是 G3 真实数据验收，也不代表正式经营指标已经由服务端统计接口确认。**

## 截图

- `raw/screenshots/DESIGNER-PERFORMANCE-1440x900.png`
- `raw/screenshots/DESIGNER-PERFORMANCE-1280x800.png`
- `raw/screenshots/DESIGNER-PERFORMANCE-1024x768.png`

## 后续必须补验

1. 使用真实设计师账号确认只统计本人负责客户、报价和项目。
2. 与 App 和服务端经营统计口径对账，确认转化率和接受率分母。
3. 验证不展示成本、毛利、利润和其他设计师业绩。
4. 补真实数据下 1440 / 1280 / 1024 三档和键盘路径。
5. 如后续要求服务端正式报表，回到 App / 后端 Provider 决策，不在 Web 单端新增统计接口。
