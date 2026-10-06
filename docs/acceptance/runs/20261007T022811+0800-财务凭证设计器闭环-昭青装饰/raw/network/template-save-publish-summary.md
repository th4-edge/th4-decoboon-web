# 凭证模板前后端交互摘要（已脱敏）

## 浏览器上下文
- 角色：Finance
- 姓名：吴濛濛
- 企业：昭青装饰
- 数据范围：Company
- Web：http://127.0.0.1:8080/finance/voucher-templates
- 浏览器：Playwright Chromium / Chrome 154

## 高级设计器保存
- 请求：POST /api/document/template/save
- 状态：200 OK
- 触发：编辑标题字号 20 -> 22，增加标题下边框，点击“保存新版本”
- UI 结果：企业模板已保存（版本 2）
- 版本卡：付款单 · 草稿 V2 · 已发布 V1
- 后续：POST /api/document/template-version/page => 200 OK

## 发布 V2
- 请求：POST /api/document/template/publish
- 状态：200 OK
- UI 结果：模板 V2 已发布
- 版本卡：付款单 · 草稿 V2 · 已发布 V2
- 版本历史：V2 发布时间 2026-10-07 02:36:16；V1 发布时间 2026-10-07 02:32:05
- 后续：POST /api/document/template-version/page => 200 OK

## 修复前错误
- 高级设计器出现 Vue 递归更新错误，见 ../console/XA-20261007-001-before-fix.txt。
- 修复 structuredClone 前，点击保存未发出 document/template/save 请求。
- 数据库 JSON 列仍为 TINYTEXT 时，保存返回 Data too long。
- 模板列表响应嵌套 versions 时，响应巨大且 JSON 截断，前端提示“请求失败”。
