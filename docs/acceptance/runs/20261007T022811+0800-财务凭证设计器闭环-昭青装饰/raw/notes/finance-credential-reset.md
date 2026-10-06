# 本地财务测试凭证重置记录

- 时间：2026-10-07 02:46:42 +08:00
- 环境：本地 decoboon
- 账号：19900000002 / 吴濛濛 / Finance
- 原凭证行备份：`/Users/zhangwei/.decoboon-local/cred-19900000002-before-20261007-0245.tsv`
- 变更：设置已知临时口令，清空失败次数和锁定，不要求下次改密。
- 验证：`auth/session/password-login` 返回 `success=true`。
- 边界：仅本地测试账号；未修改生产数据库。
