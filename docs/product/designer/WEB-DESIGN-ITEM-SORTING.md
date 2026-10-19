# 设计方案分项排序（Web）

> 状态：已实现（2026-10-19）
> 范围：设计师 Web「设计方案工作台 → 设计方案分项」
> 后端：`design/items/reorder`、`design/items/save`、`design/scheme/info`

## 一、已确认口径

1. **排序范围**：区域 → 分项类型 → 组内自定义。
   - 区域顺序沿用方案空间 `sort`。
   - 分项类型顺序沿用工作区固定顺序：施工 → 主材 → 全屋定制 → 电器 → 软装 → 综合。
   - 同一区域、同一类型内允许设计师自定义顺序。
2. **新增插入位置**：新分项默认插到当前选中行之后；仅当新增项与选中行属于同一区域、同一类型时成立，否则退化为该组末尾。
3. **报价联动**：设计分项排序只影响后续生成的报价行顺序；已生成报价是快照，不回写。
4. **历史数据**：允许按当前展示顺序一次性回填 `sort`，并保留备份与回滚。

## 二、实现要点

- Web `DesignItem` 读模型补齐 `sort`，草稿缓存保留 `sort` 与 `orderDirty`。
- 分项表工具栏新增「排序 / 完成排序」。
  - 支持拖动行首手柄调整本组顺序。
  - 支持 ↑ / ↓ 上移、下移。
  - 跨组拖动不改变区域/类型，不做隐式业务归属变更。
- 新增「纯排序」自动保存：
  - 排序变化调用 `design/items/reorder`，只更新 `sort`，不重新校验/覆盖项目库快照。
  - 脏行仍走 `design/items/save`。
  - 同一轮既有脏行又有排序时，先保存脏行，再提交整单顺序。
- 报价选择器多选序号显示 1、2、3…，按点击顺序添加。
- 报价视图 `QuoteViewContext` 按 `QuoteLine.sort` 稳定排序；重复值用 `itemId` 兜底。

## 三、数据修复

- 迁移：`docs/design/migrations/117-设计分项排序回填.sql`
- 回滚：`docs/design/migrations/rollback/117-设计分项排序回填-rollback.sql`
- 备份表：`db_design_item_sort_backup_117`
- 回填顺序：综合项目优先 → 区域 `sort` → 分项类型固定顺序 → 原 `sort` → `item_id`。

## 四、验收记录（本地 dev）

- 74 项方案：第二项上移后自动保存成功，DB 与 `design/scheme/info` 均返回新顺序；刷新后顺序保持；随后已恢复原顺序。
- 复制方案验证：选中第一行后新增同类型分项，新增行落在第 2 行；自动保存后 DB `sort` 连续；验证后已删除副本。
- `DesignItemReorderTest`、`QuoteViewContextTest`、`QuoteContextBusinessRulesTest`、`HybridQuoteBuilderTest`、`QuoteCalcContextTest` 通过。
- Web `type-check`、`build` 与 9 项治理门禁通过。

## 五、可用性修正（2026-10-19）

- 设计分项工具栏、分组头和行操作补齐线性图标；顶部设计工作区动作按钮同步补齐图标。
- 「方案总金额」改为高对比渐变金额卡，金额使用 KPI 字号（32px），并保留“正式报价以服务端汇算为准”口径。
- Excel 粘贴从隐藏 `paste` 事件改为显式入口：
  - 工具栏「Excel 粘贴」打开预览对话框；
  - 支持表头、Tab/逗号分隔、区域留空、工程量留空按 1；
  - 先显示逐行匹配结果（可添加 / 未匹配 / 区域不存在 / 工程量错误），确认后只添加可匹配行；
  - 提供 CSV 模板下载。
- 直接在设计分项区域粘贴时也会打开同一预览对话框，不再静默跳过未匹配行。

## 六、全屏弹窗修正（2026-10-19）

- 设计分项全屏时，Excel 预览对话框曾因 `append-to-body` 被 Teleport 到全屏元素之外而不可见。
- 修正：Excel `el-dialog` 使用 `:append-to-body="!fullscreen"` 与 `:modal-append-to-body="!fullscreen"`，全屏时在分项工作区内渲染。
- 已验证：全屏下点击「Excel 粘贴」可正常显示对话框，尺寸 820×494，位置在视口内；退出全屏后恢复普通弹窗。
