# 量房与方案文件上传 · 页面落地与布局冒烟验收

- 日期：2026-10-06
- 批次：`DESIGNER-FILE-EVIDENCE-20261006`
- 页面：`/designer/customers`、`/designer/design/:designId`
- 分辨率：1440×900 / 1280×800 / 1024×768
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`

## 本轮完成

1. 量房结论新增现场照片、结构图 / 图纸、其他附件上传。
2. 量房证据展示：已保存的现场照片、结构图和附件可以打开查看。
3. 量房保存继续走既有 `property/measure/save`，文件路径与文本结论同次提交。
4. 设计工作区新增「图纸与参考图」区块：
   - 方案封面
   - CAD 文件
   - 原始户型图
   - 现场照片
   - 勘测图 / 原始图纸
   - 拆除图 / 砌墙图 / 优化图
5. 方案文件保存走既有 `design/scheme/update`，不新增文件字段语义。
6. 文件上传与下载统一走 `file/private/grant` 私有文件 Provider，业务字段只保存相对存储路径，展示时签发短期 URL。

## Provider 路由

| 用途 | Provider |
| --- | --- |
| 上传 / 签名 | `file/private/grant` |
| 量房保存 | `property/measure/save` |
| 方案文件保存 | `design/scheme/update` |

## 验证结论

| 项 | 结果 |
| --- | --- |
| `npm run type-check` | PASS |
| `npm run build` | PASS |
| 量房上传对话框渲染 | PASS（布局截图） |
| 设计图纸与参考图区块渲染 | PASS（三档布局截图） |
| 浏览器控制台 | 0 error / 0 warning |
| 真实文件上传 / 下载 / 私有 URL 过期 | 待真实设计师账号登录后补验 |
| 文件类型、大小、数量限制 | 待业务 / 后端文件和验收补验 |

## 数据说明

本轮截图使用路由 Mock 验证量房证据上传入口和设计图纸 / 参考图区块的布局。**没有提交真实文件，也没有把 Mock 文件路径写入真实业务数据。**

## 截图

- `raw/screenshots/MEASURE-EVIDENCE-DIALOG-1440x900.png`
- `raw/screenshots/DESIGN-FILES-1440x900.png`
- `raw/screenshots/DESIGN-FILES-1280x800.png`
- `raw/screenshots/DESIGN-FILES-1024x768.png`

## 后续必须补验

1. 使用真实设计师账号上传图片、PDF、CAD、DWG 等真实文件。
2. 验证私有文件 URL 签发、过期刷新和未授权访问拒绝。
3. 验证业务对象删除 / 替换文件后的引用一致性和遗留文件清理策略。
4. 补文件类型、大小、数量限制与失败恢复。
5. 真实数据下补三档布局、键盘路径和控制台证据。
