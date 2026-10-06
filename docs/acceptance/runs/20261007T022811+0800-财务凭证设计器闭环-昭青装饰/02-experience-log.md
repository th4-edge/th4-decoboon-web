# 财务角色体验日志

## S01-finance-designer-load

- 角色：Finance 吴濛濛
- URL：`http://127.0.0.1:8080/finance/voucher-templates`
- 目标：从快速版式进入高级设计器。
- 结果：画布、字段库、属性面板、表格、边框、网格、打印边界和缩放均可见。
- 修复前：控制台连续出现 `Maximum recursive updates exceeded in component <FinanceVoucherTemplatesView>`。
- 修复后：高级设计器加载，控制台 `Errors: 0, Warnings: 0`。
- 结论：PASS。

## S02-finance-designer-save-v2

- 目标：将企业工资发放凭证做成企业自定义版本。
- 操作：标题字号从 20 调为 22；增加标题下边框；点击“保存新版本”。
- 网络：`POST /api/document/template/save => 200`。
- 页面：提示“企业模板已保存（版本 2）”。
- 版本区：`付款单 · 草稿 V2 · 已发布 V1`。
- 控制台：0 error / 0 warning。
- 结论：PASS。

## S03-finance-designer-publish-v2

- 操作：点击“发布当前版本”。
- 网络：`POST /api/document/template/publish => 200`。
- 页面：提示“模板 V2 已发布”。
- 版本区：`付款单 · 草稿 V2 · 已发布 V2`。
- 控制台：0 error / 0 warning。
- 结论：PASS。

## S04-finance-designer-reopen

- 目标：刷新后确认企业模板仍存在并可从持久化配置进入编辑。
- 结果：修复后的模板列表接口返回有效 JSON，企业模板 `工资发放凭证 V1/V2` 可读。
- 版本状态显示 `[object Object]`，已做前端解析修复，但后端重启后会话失效，未完成最终浏览器复验。
- 结论：PARTIAL。
