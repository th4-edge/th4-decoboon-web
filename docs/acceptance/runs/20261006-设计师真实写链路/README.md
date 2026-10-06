# 设计师 Web · 真实写链路验收

- 日期：2026-10-06
- 批次：`DESIGNER-REAL-WRITE-20261006`
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`
- 身份：设计师「董夏鹏」，昭青装饰 · 总店 · Self
- 数据：真实报价 `Q1791255843140`，quoteId `233061715925794816`
- 目标行：`233061716013875200` 拆除--飘窗拆除后砌砖+粉刷

## 一、写链路步骤与结果

| 步骤 | 工程量 | 行金额 | 服务端正式总额 | 结果 |
| --- | --- | --- | --- | --- |
| 保存前 | 42 | ¥18,123.00 | ¥44,874.13 | 基线 |
| 改为 43 → 保存 | 43 | ¥18,554.50 | **¥45,304.56** | PASS：已保存并重算 |
| 改回 42 → 保存 | 42 | ¥18,123.00 | **¥44,874.13** | PASS：已保存并重算，数据还原 |

- 保存后页面自动重新读取服务端报价，`quote/lines/save` 写入成功。
- 金额变化由服务端重算：工程量 +1，行金额 +¥431.50，正式总额 +¥430.42（含折扣/税额口径）。
- 测试数据已完整还原，未留下报价终态变化。

## 二、发现并处理的后端阻塞

### BLOCK-REAL-001 · 热重载缺少 QuoteFormulaContext$Sheet

- 现象：首次保存返回 500。
- 后端日志：`NoClassDefFoundError: com/th4/edge/decoboon/quote/context/QuoteFormulaContext$Sheet`
- 原因：IDE 热重载后的运行 classloader 缺少内部类。
- 处置：执行 `mvn -q -DskipTests compile`，停止旧后端，使用 `./run-dev.sh` 干净重启。
- 复验：重启后报价保存链路 PASS。

### 本地测试账号重置

- 干净重启后旧会话失效。
- 用户授权重置本地测试账号 `19900000005` 的密码。
- 已通过本地数据库更新 BCrypt 密码哈希，并清空失败次数和锁定状态。
- 重置后自动登录成功，继续完成写链路复验。

## 三、发现并修复的前端缺陷

### DEF-REAL-004 · 保存失败原因被重试按钮挤掉

- 现象：保存失败时只显示“保存失败，编辑内容已保留”和“重试保存”，看不到具体原因。
- 原因：`QuoteDecisionPanel` 使用 `el-alert` 默认插槽后，`description` 属性不再渲染。
- 修复：把错误文案和重试按钮一起放入默认插槽。
- 复验：错误栏可以看到真实 500 / token / 冲突原因。

## 四、验证结论

| 项 | 结果 |
| --- | --- |
| 真实报价读取 | PASS |
| `quote/lines/save` 真实写入 | PASS |
| 服务端重算 | PASS |
| 保存后回读 | PASS |
| 写后还原 | PASS |
| 浏览器控制台 | 0 error |
| 最终服务端金额 | ¥44,874.13（与写前一致） |

## 五、截图证据

- `raw/screenshots/REAL-QUOTE-RESTORED-1440x900.png`
- `raw/screenshots/REAL-QUOTE-WORKBOOK-IMPORT-PREVIEW-1440x900.png`
- `raw/screenshots/REAL-QUOTE-WORKBOOK-ROUNDTRIP-1440x900.png`
- `raw/screenshots/REAL-QUOTE-MULTI-SELECT-1440x900.png`
- `raw/screenshots/REAL-QUOTE-MULTI-DELETE-CONFIRM-1440x900.png`
- `raw/screenshots/REAL-MATERIAL-SELECTION-DRAFT-1440x900.png`
- `raw/screenshots/REAL-MATERIAL-SELECTION-PENDING-1440x900.png`
- `raw/screenshots/REAL-MATERIAL-SELECTION-RESTORED-1440x900.png`

## 六、主材选材真实写入

- 项目：`232968907537776640` 荷塘家园-陈先生
- 主材分项：`[验收基准-荷塘] 主材项目`
- 写入类型：`material/selection/save`，状态 `Draft`
- 写入内容：测试浅灰 / 300×600mm / 测试品牌 / 常规铺贴
- 验证结果：保存后状态变为「草稿」，待选样计数 0；刷新后仍存在。
- 本地即时刷新：保存接口刚写入后列表投影存在短暂滞后，已修复为使用服务端保存响应局部更新，不再要求用户手动刷新。
- 本地更新字段保护：不能把 `MaterialSelection` 响应直接整体覆盖 `MaterialSelectionItem`，已改为只合并选材相关字段，保留项目名、空间、分类、数量等主材分项字段。
- 残留说明：当前没有删除选材草稿的 Provider，因此在测试项目上留下 1 条明确标记为「Codex 真实写链路验收草稿，可人工删除」的 Draft。该草稿不改变报价、合同、成本、材料计划或采购事实。

### 提交客户确认并还原

- 通过页面「提交客户确认」调用 `material/selection/save`，状态由 `Draft` → `PendingConfirm`；待确认筛选计数由 0 → 1，刷新后仍为「待客户确认」。
- 随后在同一未锁定版本通过「保存草稿」调用 `material/selection/save`，状态由 `PendingConfirm` → `Draft`；待确认筛选计数恢复 0，刷新后仍为「草稿」。
- 结果：提交与回退均 PASS，测试数据恢复为验收草稿状态，未留下待客户确认终态。
- 证据：`REAL-MATERIAL-SELECTION-PENDING-1440x900.png`、`REAL-MATERIAL-SELECTION-RESTORED-1440x900.png`。

## 七、报价工作簿导出 / 导入真实闭环

- 报价：`Q1791255843140`，quoteId `233061715925794816`，草稿 V3，6 行。
- 导出：页面「导出 Excel」成功生成 `Q1791255843140-内部工作版-V3.xlsx`，工作簿含 1 个明细 Sheet、6 条报价行。
- 导入预览：原工作簿回读 `/api/quote/workbook/import` 返回 200；页面显示共 6 行、可导入 6 行、错误 0 行。
- 确认落库：`/api/quote/workbook/apply` 返回 200，模式 `MERGE`；导入后服务端正式总额仍为 ¥44,874.13，行集合、工程量和金额均未变化。
- 浏览器证据：上述两条 Provider 请求均为 200，控制台 0 error / 0 warning。
- 截图：`REAL-QUOTE-WORKBOOK-IMPORT-PREVIEW-1440x900.png`、`REAL-QUOTE-WORKBOOK-ROUNDTRIP-1440x900.png`。

## 八、报价多行选择删除交互

- 在 V3 草稿中选择 2 条真实报价行，工具栏显示「删除选中 (2)」。
- 点击后显示「确定删除选中的 2 行？删除后由服务端重新计算报价。」确认框；本轮点击取消，未调用删除 Provider，未改变服务端行集合或总额。
- 实现复用既有 `quote/line/delete`，支持逐行结果跟踪；失败行保留选择，不静默跳过。
- 验证结果：多选、计数、确认文案和取消保护 PASS；真实删除落库尚需在可还原测试报价上补验。
- 截图：`REAL-QUOTE-MULTI-SELECT-1440x900.png`、`REAL-QUOTE-MULTI-DELETE-CONFIRM-1440x900.png`。

## 九、本轮未覆盖

1. 报价提交客户确认、真实删除报价行（单行 / 批量最终落库）。
2. 文件上传真实落库和私有 URL 过期。
3. 阶段验收提交、增减项发起、客户签认。
4. 1280 / 1024 真实数据三档复验。
5. 非设计师账号、其他设计师数据、跨门店/跨企业的权限负向。
