# 凭证设计器收口：分页可视化 + 版本状态口径 + 三档回归

- 日期：2026-10-11
- 批次：`VOUCHER-CLOSEOUT-20261011`
- 承接：`20261007T022811+0800-财务凭证设计器闭环-昭青装饰`（该 run 状态 `PARTIAL`）
- 依据：`docs/product/finance/WEB-VOUCHER-DESIGNER-GAP-LIST.md`（门禁 A/B/C + 旁路 D）
- 环境：Web `http://127.0.0.1:8080` + 后端 `http://127.0.0.1:8090`（本地 dev）；账号：财务 吴濛濛 19900000002

## 一、本轮处置

| 缺口 | 内容 | 结论 |
| --- | --- | --- |
| B3 | 版本历史状态列（原 `[object Object]`，`XA-20261007-005` 为 `FIXED_PENDING_VERIFY`） | ✅ 已复验并**进一步修中文口径** |
| C1 | 打印分页可视化 | ✅ 新增（打印分页线 + 每页行数提示 + 越界告警） |
| C6 | 三档分辨率回归 | ✅ 三档无横向溢出 + 截图（见「四、环境异常说明」） |
| C7/D4 | 真实 PDF 渲染对照 + 真实出证 | ✅ **已完成**（含字段级对照；见 §三·补充与根因修复） |

## 二、代码改动

| 文件 | 改动 |
| --- | --- |
| `src/components/finance/VoucherDesignerCanvas.vue` | 新增**打印分页可视化**：按「表头（估算 8mm）+ 每页行数 × 行高」推算分页线并在纸张上绘制（标注「第 N 页起 · 每页 X 行」）；新增**可打印区域越界告警**（表格每页行数超可打印高度、表格框高越界、元素底边越界）与选中表格的分页提示 |
| `src/domains/document/meta.ts` | **新增**：`TEMPLATE_VERSION_STATUS_META`（与后端 `DocumentTemplateVersionStatus` 同源：草稿/已发布/已替代/已停用）+ 未登记状态显示「待业务确认」 |
| `src/views/finance/FinanceVoucherTemplatesView.vue` | 版本历史状态列由直接渲染枚举值改为 `StatusTag` + 中文口径 |

**未改**：后端、模板持久化结构、金额口径、权限矩阵；未新增版式字段（`colSpan` / 底图等仍待业务裁决）。

## 三、真实浏览器复验

| # | 项 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | B3 版本历史状态 | **PASS**：`4 草稿 / 3 草稿 / 2 已发布 / 1 已替代`（不再 `[object Object]`，且不再暴露英文枚举） | 浏览器实测 |
| 2 | C1 分页线 | **PASS**：设计师内新增表格（y=80mm、10 行/页、行高 8mm）后渲染 2 条分页线「第 2 页起 · 每页 10 行」「第 3 页起 · 每页 10 行」 | 浏览器实测 |
| 3 | C1 分页提示 | **PASS**：工具栏显示「选中表格每页 10 行 · 行高 8mm · 表头重复已开启（分页线按表头 8mm 估算）」+「可打印底边 285 mm」 | 浏览器实测 |
| 4 | C1 越界告警 | **PASS**：把每页行数改为 30 后出现「表格「…」每页 30 行超出可打印高度（可打印底边 285mm，占用至 328mm），打印时会被截断；请减少每页行数或行高，或下移表格。」，且分页线正确消失 | 浏览器实测 |
| 5 | C6 1440×900 | **PASS**：`scrollWidth - clientWidth = 0`，分页线 2 条，无告警 | `voucher-designer-1440x900.png` |
| 6 | C6 1280×800 | **PASS**：溢出 0，分页线 2 条 | `voucher-designer-1280x800.png` |
| 7 | C6 1024×768 | **PASS**：溢出 0，分页线 2 条 | `voucher-designer-1024x768.png` |
| 8 | D4 真实出证（资金台账 → 批量生成凭证） | **PASS**：选中 3 条同对方/同项目/同款项类型流水（`其他杂项收入`，合计 ¥7.02）→ 提示「凭证 PZ202610110648500001 已生成」，`document/voucher/page` 返回 1 条凭证（type=收款单、status=有效） | 浏览器实测 + API 核对 |
| 9 | D4 合并前置校验（负向） | **PASS**：选 2 条**不同分类**的手工支出流水 → 被拦「仅可合并收款方/付款方、项目、款项类型三者相同的记录」，未生成凭证 | 浏览器实测 |
| 10 | D4 同笔重打同号 | **PASS**：用同一组 3 条流水再次点击生成 → 仍返回**同一凭证号** `PZ202610110648500001`，未产生第二条凭证事实 | 浏览器实测 + API（凭证总数仍为 1） |
| 11 | C7 凭证 PDF 可获取 | ✅ **PASS（修复后）**：200 / 61,913 B / `%PDF-1.5` / 1 页 / A4 纵向 | `voucher-PZ202610110648500001.pdf` |
| 12 | C7 PDF 与来源事实字段级对照 | ✅ **PASS**：凭证号、金额合计（7.02，含大写「柒元零贰分」）、对方、3 条明细、抬头、签字栏、边界声明、纸张全部一致；企业模板不匹配时**正确回退平台基线收款模板** | `voucher-pdf-field-comparison.md`、`voucher-pdf-extracted-text.txt` |

## 三·补充、D4 详细结果与新的环境级发现

**本地出证口径**：选中 3 条 `income / 无项目 / 对方=本地验收 / 分类=其他杂项收入` 的流水（手工其他收入），合计 ¥7.02。

**新发现（环境级，非凭证专属）**：`file/private/download` 对**所有**私有文件均返回 404 ——
- 后端 `logs/log_error.log` 中 `file/private/download处理失败:文件不存在或无权访问` 在 **06:22 / 06:36 / 06:47:34** 已多次出现，**早于本次出证（06:48）**；
- 本地存储配置：`TH4_STORAGE_PROVIDER=oss`、`TH4_FILE_UPLOAD_DIR=/opt/decoboon/data/upload`、`ALIYUN_OSS_KEY_PREFIX` 为空；
- 结论：**凭证事实链路正常**（生成、幂等同号、状态有效），但**凭证据下载通道在本地环境不可用**，疑似本地 OSS 读写/下载配置问题，需单独排查；不作为凭证设计器的页面缺陷计入。
- 已登记 `GAP-WEB-020`（本地私有文件下载 404，阻塞 Web 侧所有「产物可获取」类验收）。

**GAP-WEB-020 根因（2026-10-11 只读排查，已定位）**：本地 `TH4_FILE_UPLOAD_DIR=/opt/decoboon/data/upload` 指向**不可写**目录（`/opt` 属 root，且 `/opt/decoboon` 不存在）。OSS 回源下载必须先把对象 spool 到 `uploadDir/.download-spool/`，`Files.createDirectories` 失败 → 被 catch → 404。

取证链：
1. 用应用自身 OSS 密钥只读探测出证对象 → **存在**（61,913 B、`application/pdf`、有 ETag）→ **写路径正常**；
2. 读 `FileSignatureContext.materialize/spool` → 远程存储下载**多一道本地 spool 前置**，失败即 404；
3. `ps eww <pid>` 读**进程实际环境变量** → `TH4_FILE_UPLOAD_DIR=/opt/decoboon/data/upload`、`TH4_STORAGE_PROVIDER=oss`；
4. 仓库内 `data/upload/.download-spool` 最后写入 **2026-10-10 00:44**（当时用相对默认 `./data/upload/`），10-11 起再未成功；
5. 日志同一条 404 自 **06:22** 起多次出现，早于本次出证（06:48）→ 影响一切私有文件。

**修复（已执行并验证）**：
1. 备份 `.env.dev.local` → `.env.dev.local.bak-20261011-gapweb020`；
2. 将 `TH4_FILE_UPLOAD_DIR` 改为仓库内可写目录（绝对路径 `…/th4-decoboon/data/upload`，该目录已在 `.gitignore`）；
3. 停掉旧实例（含一个未监听端口的冗余实例）→ 用 `./run-dev.sh` 以修正后的环境重启（持久会话）；
4. **验证**：原凭证 URL 直接下载成功——`http=200`、`size=61913`、`content_type=application/pdf`、文件头 `%PDF-`；`data/upload/.download-spool/` 出现新的 hash 落盘目录 → 走的正是被修复的 spool 路径，**与根因判断一致**。

**环境副作用披露**：修复过程中停止了 2 个旧后端实例、启动了 1 个新实例（现仅 1 个实例，顺带解决了双实例问题）；`.env.dev.local` 已备份。

**本地数据变更披露**：本次真实出证在本地 dev 库新增 **1 条凭证记录** `PZ202610110648500001`（type=收款单、status=有效），对应 3 条手工收入流水；同笔重打未新增记录。

## 四、环境异常说明（如实登记，不计入页面缺陷）

1. **本地 Vite dev server 两次被终止**（`ERR_CONNECTION_REFUSED @ 127.0.0.1:8080`）：第一次由我的一条复合命令被 SIGTERM 连带结束，第二次由后台 `nohup` 进程随命令结束被回收；最终以**持久会话**方式重启并完成 1440/1280/1024 复验。
2. **1024 档的 30 条 console error 全部是 `net::ERR_CONNECTION_REFUSED @ 127.0.0.1:8080/`**，即 Vite HMR 客户端在 dev server 死亡后重连失败，**不是页面缺陷**；同一页面在三档的 DOM 检查（溢出 0、分页线 2）均通过。
3. **本地后端 8090 在复验期间被并发会话反复重启**（该会话正在修改 `ProviderSecurityValidator` / `CustomerInviteRepository` / `ContractPlanContext` / 合同 `update` 等），导致 `document/voucher/build` 无法调用 → D4/C7 无法完成。**未干预对方进程，也未绕过**。

## 五、下一步（收口剩余项）

1. **排查 `GAP-WEB-020`**：本地私有文件下载 404（影响凭证 PDF、现场照片、附件等一切私有文件），这是当前 Web 验收最硬的阻塞项。
2. 证据说明：`voucher-download-404-response.json` 是下载接口返回的 404 响应体（**不是 PDF**），保留作为证据。

文件通道恢复后补 **C7**：下载真实凭证 PDF，与设计器预览逐项对照（机构名 / 标题 / 凭证号 / 金额 / 联次 / 签字栏）。
2. `A1` 必填字段不可删除（设计器内拦截）—— 需先确认平台基线模板的「必填字段」来源字段。
3. 待业务裁决：合并单元格（`colSpan/rowSpan`）、上传底图、列宽拖动、逐行高。
