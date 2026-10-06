# 阶段验收证据上传与门禁

- 日期：2026-10-06
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`
- 真实身份：设计师「董夏鹏」，昭青装饰 · 总店 · Self
- 项目：`231352287052693504` 李安然（审计A）·滨湖云谷7栋1602

## 一、发现并修复的阻塞

### BLOCK-REAL-002 · FormData 被按 JSON 发送

- 现象：阶段验收选择现场照片后返回「业务对象不能为空」。
- 网络证据：`file/private/grant` 请求头为 `content-type: application/json`，body 中 `file` 为 `{}`，服务端没有收到 multipart 文件。
- 原因：通用 `upload()` 复用了 Axios 实例级 `Content-Type: application/json`，没有让浏览器生成带 boundary 的 multipart 请求头。
- 修复：上传请求显式移除 JSON Content-Type，由浏览器按 FormData 自动生成 multipart Content-Type。
- 复验：同一真实页面重新选择 `acceptance-evidence-upload-test.png`，上传成功并返回私有文件路径与签名 URL。

### DEF-REAL-005 · 验收表单缺少复验必填项

- 业务规则：BR-008 / SCN-010 规定第 2 轮复验必须提交整改说明和整改后照片。
- 原实现：Web 对话框只有验收说明、问题清单和现场证据，无法通过服务端复验校验。
- 修复：识别 `Rejected` 验收单后显示「整改说明」和「整改后照片」必填项，并随 `project/acceptance/save` 提交。
- 状态：代码与构建 PASS；因当前真实项目没有“任务全部完成且已驳回”的阶段，真实复验落库待补验。

### DEF-REAL-006 · Web 未阻断无任务/未完成任务阶段

- 业务规则：阶段任务全部完成后才能提交验收。
- 原实现：Web 只判断是否存在验收单，无验收单即可打开提交框。
- 修复：加载真实任务；无任务或存在未完成任务时禁用提交，并显示具体阻断原因。
- 复验：测试项目的「开工交底」为 0 任务，页面显示「暂不能提交验收」，提交按钮 disabled，控制台 0 error / 0 warning。

## 二、文件上传 Provider 验证

| 验证项 | 结果 |
| --- | --- |
| 登录员工 multipart 上传 | PASS：`file/private/grant` 返回 200，生成项目内路径 |
| `projectId` 归属 | PASS：路径包含 `projects/231352287052693504/...` |
| 私有签名 URL | PASS |
| 签名 URL 立即下载 | PASS：HTTP 200，68 bytes |
| 签名过期 | PASS：伪造过期 `Expires=1` 返回 OSS 403 `Request has expired` |
| 未签名原始路径 | PASS：HTTP 404，不能绕过签名 |
| 无 token 上传 | PASS：`tokenIsUndefined`，服务端拒绝 |

网络证据：

- `raw/network/upload-provider-success.json`
- `raw/network/upload-permission-negative.json`
- `raw/network/download-boundary.txt`

## 三、页面证据

- `raw/screenshots/REAL-ACCEPTANCE-EMPTY-STAGE-GUARD-1440x900.png`

## 四、尚未完成

1. 当前项目池中没有“至少一项任务全部完成、且尚无验收单”的阶段，因此没有制造空阶段验收单来完成 `project/acceptance/save` 首次提交。
2. 当前项目池中没有“任务全部完成且已驳回”的阶段，因此复验字段仍待真实落库验证。
3. 上传测试在对象存储中留下明确命名的验收测试对象，但没有绑定任何验收记录，不改变阶段状态、金额、成本或轮次。

## 五、构建结论

- `npm run type-check`：PASS
- `npm run build`：PASS
- 真实页面控制台：0 error / 0 warning
