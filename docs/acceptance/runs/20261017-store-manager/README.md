# 店长能力第一批 Web 冒烟（2026-10-17）

- 环境：本地 dev，Web `http://127.0.0.1:5173`，后端 `http://127.0.0.1:8090`
- 账号：店长 王洪文 `19900000003`
- 企业/门店：昭青装饰 / 总店
- 浏览器：Playwright Chromium
- 结论：页面真实加载，控制台 0 error；经营结果页目标保存后回读 1,100,000；业务承接页显示本店 1 个已续营项目。

## 截图

- `store-overview-1440.png` / `store-overview-1280.png` / `store-overview-1024.png`
- `store-carryover-1440.png` / `store-carryover-1280.png` / `store-carryover-1024.png`

## 未完成

- 截图视觉批判未执行（当前会话无法读取图像内容）。
- 未做 App 真机/开发者工具走查。
- 未做多门店跨店账号与合同变更审批/承接代确认正向。
- 本次待审批变更挂在 Finished 项目，活动项目列表不含 Finished，审批页回落到活动项目；需历史项目入口。
