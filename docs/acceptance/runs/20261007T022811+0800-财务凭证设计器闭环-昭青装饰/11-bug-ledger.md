# BUG 缺陷台账

| ID | 严重度 | 状态 | 角色 | URL/分辨率 | 最小复现 | 期望 | 实际 | 证据 | 复现率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| XA-20261007-001 | P1 | FIXED_VERIFIED | Finance | `/finance/voucher-templates` / 1440x900 | 进入高级设计器 | 可编辑且无递归更新 | 修复前 Vue 最大递归更新 | `raw/console/XA-20261007-001-before-fix.txt` | 100% |
| XA-20261007-002 | P1 | FIXED_VERIFIED | Finance | 同上 | 点击保存 | 发出 save 请求 | 修复前无请求，被 structuredClone 代理错误阻断 | `raw/network/template-save-publish-summary.md` | 100% |
| XA-20261007-003 | P1 | FIXED_VERIFIED | Finance | 同上 | 保存 JSON 超过 255 字节 | JSON 完整落库 | TINYTEXT 报 Data too long | `raw/sql/02-schema-after-designer-config.sql`、`04-persistence-verification.out` | 100% |
| XA-20261007-004 | P1 | FIXED_VERIFIED | Finance | 同上 | 保存后重载模板列表 | 正常 JSON 和成功提示 | versions 循环导致截断响应和“请求失败” | `raw/network/template-save-publish-summary.md` | 100% |
| XA-20261007-005 | P2 | FIXED_PENDING_VERIFY | Finance | 版本历史 | 查看状态列 | 显示已发布/草稿 | `[object Object]` | `raw/notes/advanced-designer-after-save-v2.yml` | 100% |
