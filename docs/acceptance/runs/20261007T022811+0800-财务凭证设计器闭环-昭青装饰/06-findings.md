# 问题与整改

## XA-20261007-001 · P1 · FIXED_VERIFIED

- 标题：高级设计器父子上传形成 Vue 递归更新。
- 复现：进入高级设计器后控制台持续报 `Maximum recursive updates exceeded`。
- 修复：以结构化相等保护替代无保护的父子深监听回写。
- 验证：修复后高级设计器加载和编辑，控制台 0 error / 0 warning。

## XA-20261007-002 · P1 · FIXED_VERIFIED

- 标题：`structuredClone` 克隆 Vue Proxy 导致保存未发请求。
- 复现：点击保存无网络请求，页面显示“模板保存失败，暂不可确认”。
- 修复：改为 JSON 纯数据克隆。
- 验证：保存发出 `document/template/save`，返回 200，生成 V2。

## XA-20261007-003 · P1 · FIXED_VERIFIED

- 标题：模板 JSON 列被 Hibernate 建为 TINYTEXT。
- 复现：保存报 `Data too long for column 'designer_config'`，随后 `field_config` 同样失败。
- 修复：迁移 85 统一四个 JSON 列为 LONGTEXT；实体显式 `columnDefinition = "LONGTEXT"`。
- 验证：模板表和版本表均为 LONGTEXT，重启后未被回改；V2 designerConfig 3444 字节落库。

## XA-20261007-004 · P1 · FIXED_VERIFIED

- 标题：模板响应嵌套版本历史导致循环 JSON 和响应截断。
- 复现：模板列表/保存响应达到 MB 级并出现非法 JSON，页面提示“请求失败”。
- 修复：列表、保存、发布、停用响应不再内嵌 versions；版本历史走独立接口。
- 验证：模板列表响应恢复约 50 KB 且可解析；保存和发布页面成功提示正常。

## XA-20261007-005 · P2 · FIXED_PENDING_VERIFY

- 标题：版本历史状态显示 `[object Object]`。
- 修复：`versionOf` 对枚举对象使用 `valueOf` 提取展示名。
- 验证：类型检查和 Web 构建 PASS；因测试财务会话在后端重启后失效，未完成浏览器复验。

## 产品差距

- 智慧记式表格合并、拆分、逐行高、列宽拖拽、打印分页预览、冻结/重复区域仍不完整。
- 本次仅验证配置设计、保存、发布与持久化；未验证 PDF 打印稿和真实套打边界。
