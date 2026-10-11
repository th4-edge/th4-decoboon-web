# 场景 / 状态矩阵（设计师角色）

| 阶段 | 页面 | 动作 | 状态变化 | 结果 | 证据 |
| --- | --- | --- | --- | --- | --- |
| 客户录入 | /designer/my-customers | 新增客户 | 无 → 待首联（新客户） | PASS | 003/004 |
| 房屋建档 | 客户 360 | 新增房屋 | 无 → 待量房 | PASS | 005/006 |
| 量房预约 | /designer/measure | 安排量房 | 未预约 → 已预约·待上门 | PASS | 008/009 |
| 量房结论 | /designer/measure | 登记量房结论（含现场照片） | 待上门 → 已量房 / 量房完成·待交设计 | PASS | 010/011 |
| 设计建档 | /designer/measure → 新建方案 | 创建设计方案 | — → 设计工作区（设计中） | PASS | 012/013 |
| 区域实测 | /designer/design/:id | 新增区域（实测面积/周长） | 0 → 2 个空间（Measured） | PASS | 014 |
| 分项选择 | /designer/design/:id | 从报价项目库加 2 项 | 0 → 2 个设计项 ¥3,297.60 | PASS | 015/016 |
| 完成设计 | /designer/design/:id | 完成设计，进入待谈单 | 设计中 → 待谈单 | PASS（含 XA-001 前端覆盖缺陷） | 017/019 |
| 报价生成 | /designer/quotes/:id | 生成报价草稿 | — → V1 草稿 ¥3,462.48 | PASS | 020 |
| 报价提交 | /designer/quotes/:id | 提交客户确认 | 草稿 → 待客户确认 | PASS | 021 |
| 合同 | /designer/contract | 发起/确认合同 | — | **BLOCKED**（设计师端无此动作） | 022 |
| 项目立项 | /designer/projects | 查看项目 | — | NOT_TESTED（新方案无项目） | 023 |
| 阶段验收 | /designer/projects/:id/acceptance | 提交阶段验收 | — | **BLOCKED**（非参与人，按钮 disabled） | 025 |
| 业主确认 | — | 确认/驳回验收 | — | **BLOCKED**（必须业主本人，员工不得代录） | 025 文案 |
| 交房 | — | 竣工保洁验收 + 业主确认 | — | **BLOCKED** | 025 |

汇总：PASS 10 · BLOCKED 4 · NOT_TESTED 1。

## 多角色推进（2026-10-11 05:18–05:30，角色切换）

| 阶段 | 角色 | 页面 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| 合同发起 | 设计师 | `/designer/contract` | PASS（生成 PendingSign 合同 C1791667228333） | verify-012/013/014 |
| 合同确认签约 | 企业负责人 | `/designer/contract` | **FAIL**：唯一主行动禁用，无入口（XA-012） | verify-019 |
| 合同确认签约 | 店长 | `/designer/contract` | **FAIL**：/forbidden（XA-013） | verify-017 |
| 确认生效/立项 | — | `project/contract/update` | API_SIMULATED（Web 无入口）→ 项目 P1791667364957 | raw/sql/verify-project-generation.txt |
| 指派项目经理 | — | `project/project/update` | API_SIMULATED（Web 无入口，XA-016） | verify-021/022 |
| 项目开工 | 项目经理 | `/pm/workbench` | **FAIL**：400 不涉及阶段不能开工（XA-014） | verify-025 |
| 任务推进 | 项目经理 | `/pm/workbench` | PASS（开始任务→提交验收→完成任务+证据） | verify-028/030 |
| 阶段验收提交 | 项目经理 | `/pm/projects/:id/acceptance` | PASS（第 1 轮 Pending，提交人 徐勇） | verify-031/032/033 |
| 业主确认 | 业主 | `customer/acceptance/update` | **BLOCKED_OWNER_SESSION**（员工一律 403） | 页面文案 + 代码 |

汇总（多角色段）：PASS 4 · FAIL 4 · API_SIMULATED 2 · BLOCKED 1。
