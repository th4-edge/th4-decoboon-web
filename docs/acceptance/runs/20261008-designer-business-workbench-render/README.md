# 设计师业务工作台渲染检查

> 批次：`DESIGNER-BUSINESS-WORKBENCH-RENDER-20261008`
> 类型：`DESIGN_RENDER_ONLY`
> 状态：视觉与三档分辨率结构检查 PASS
> 说明：本记录不替代业务验收，也不证明后端 HTTP 端到端链路；仅证明前端页面在真实浏览器中完成两轮渲染与修正。

## 1. 环境

- Web：`http://127.0.0.1:8080/designer/workbench`
- 浏览器：Playwright Chromium
- 身份数据：设计师董夏鹏（真实本地测试身份）
- 统计数据：从本地 MySQL 设计师 `comId=1790000000000000001`、`empId=1790000000000000105` 的真实聚合 SQL 结果构造浏览器响应，仅用于渲染检查
- 代码：未写入任何 mock 数据；临时响应仅存在于 Playwright 会话路由中

## 2. 截图证据

- `output/playwright/designer-business-workbench/1440x900.png`
- `output/playwright/designer-business-workbench/1280x800.png`
- `output/playwright/designer-business-workbench/1024x768.png`

## 3. 两轮渲染与修正

第一轮发现问题：

- 页面与壳层 topbar 重复出现“业务工作台”一级标题。
- 分布图中数量为 0 的项仍显示最小宽度条。
- 趋势图散点颜色未跟随系列颜色。
- 数量为 0 的卡片显示“暂无细分数据”，不如直接表达“当前无待办”。

第二轮修正后复验：

- 页面一级标题只保留壳层 topbar 一处；内容区改为“设计师业务总览”。
- 0 值分布条宽度为 0。
- 趋势散点继承各系列颜色。
- 0 数量卡片显示“当前无待办”。

## 4. 三档结构检查

| 分辨率 | 横向溢出 | 卡片列数 | 业务卡 | 当月概览 | 趋势图 | 分布项 | 一级标题 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1440×900 | 无 | 3 | 9 | 3 | 1 | 9 | 1 |
| 1280×800 | 无 | 2 | 9 | 3 | 1 | 9 | 1 |
| 1024×768 | 无 | 2 | 9 | 3 | 1 | 9 | 1 |

控制台：`0 error / 0 warning`。

## 5. 未覆盖

- 后端 `statistic/workbench/designer/report` 的登录后 HTTP 端到端调用。
- 真实业务数据权限负向与跨租户用例。
- 生产发布。

---

## G1 统一壳层 + 本地 ECharts 复核（2026-10-08）

本轮验收范围：

- 统一 `RoleWorkAreaShell`：深色侧栏、顶部栏、搜索、通知、用户菜单、响应式抽屉。
- Designer 业务工作台：高保真工作卡、主链步骤、当前工作分布 ECharts、独立 Today Queue、KPI 对比。
- 后端契约：`statistic/workbench/designer/report` 增加 pipeline 与 comparison；`statistic/workbench/designer/queue/list` 独立队列。
- 不验收：全角色工作台内容、生产发布、登录后真实 HTTP 端到端。

截图：

- `output/playwright/designer-business-workbench/g1-final-1440x900.png`
- `output/playwright/designer-business-workbench/g1-final-1280x800.png`
- `output/playwright/designer-business-workbench/g1-final-1024x768.png`

结构结果：

| 分辨率 | 横向溢出 | 卡片 | 第一行列数 | KPI | 主链步骤 | ECharts Canvas | Today Queue | h1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1440×900 | 无 | 10 | 3 | 3 | 4 | 1 | 3 | 1 |
| 1280×800 | 无 | 10 | 3 | 3 | 4 | 1 | 3 | 1 |
| 1024×768 | 无 | 10 | 2 | 3 | 4 | 1 | 3 | 1 |

- 1024px 下侧栏收起，顶栏菜单按钮和抽屉可用。
- 控制台：`0 error / 0 warning`。
- 队列数据来自独立 Provider；KPI 环比使用后端真实 previousValue/changeRate，客户数无基期时显示“暂无基期”。
- Today Queue 不再使用“客户接受 4”的错误口径，改为“待客户确认 4”。
- 合同动作只显示“查看合同交接”，不出现设计师签约动作。

---

## 1:1 结构与 CSS 回写复核（2026-10-08）

本轮将 Designer 页面从“已有通用组件拼装”调整为：

- 高保真 `page-head`：内容区 h1、待处理 pill、更新时间、刷新按钮。
- 高保真 `kpi-row`：3 列 KPI、32px 指标值、趋势胶囊。
- 高保真 `pipeline`：连续步骤条，不再使用四张独立步骤卡。
- 高保真 `workcards`：3 列、40px 图标容器、28px 数字、底部强调线和 bottom chip。
- 高保真 ECharts `chart-canvas`：286px 高度，5 段当前工作分布。
- 高保真 `queue`：独立 Provider 的今日队列，q-dot/q-main/q-tag/q-act 结构。
- 断点收敛为 `1240px / 1024px / 720px`。

新截图：

- `output/playwright/designer-business-workbench/g1-1to1-1440x900.png`
- `output/playwright/designer-business-workbench/g1-1to1-1280x800.png`
- `output/playwright/designer-business-workbench/g1-1to1-1024x768.png`

浏览器复验：页面 h1 1 个、KPI 3 个、步骤 4 个、工作卡 10 张、ECharts Canvas 1 个、Today Queue 3 项、无横向溢出、控制台 `0 error / 0 warning`。

---

## 自适应与按钮边框修正（2026-10-08）

修正内容：

- 自定义按钮统一清除浏览器默认 `outset` 边框和默认灰底。
- 保留高保真刷新按钮的 `1px solid` 边框。
- 断点对齐高保真：
  - `>1024px`：显示侧栏和搜索。
  - `<=1024px`：隐藏侧栏和搜索，顶栏显示菜单按钮，侧栏改抽屉。
  - `<=1240px`：工作卡降为 2 列。
  - `<=720px`：工作卡降为 1 列，KPI 单列。
- 主内容区在桌面端最大 1400px；低于 1400px 时随视口自动收缩，无横向溢出。

实测：

| 视口 | 主内容宽 | 搜索 | 侧栏 | 卡片列数 | 横向溢出 |
| --- | --- | --- | --- | --- | --- |
| 1920 | 1400 | 显示 | 显示 | 3 | 无 |
| 1440 | 1204 | 显示 | 显示 | 3 | 无 |
| 1280 | 1044 | 显示 | 显示 | 3 | 无 |
| 1024 | 1024 | 隐藏 | 抽屉 | 2 | 无 |
| 768 | 768 | 隐藏 | 抽屉 | 2 | 无 |
| 720 | 720 | 隐藏 | 抽屉 | 1 | 无 |

除刷新按钮外，页面自定义按钮和导航链接均无默认浏览器边框。

---

## 通知中心与用户菜单（2026-10-08）

- 顶栏通知图标改为铃铛。
- 点击铃铛打开通知中心，读取 `collab/notice/count` 和 `collab/notice/page`。
- 支持未读数、通知列表、单条已读、全部已读、加载/失败/空态。
- 用户菜单新增：
  - 个人信息：姓名、员工编号、手机号、角色、数据范围、门店、团队、状态。
  - 企业信息：企业名称、企业编号、地址、当前门店、团队、数据范围。
  - 退出登录。
- 浏览器验证：铃铛存在、通知面板 2 条、未读 2 条；用户菜单三项存在。

---

## 账户中心抽屉重做（2026-10-08）

原因：个人信息、企业信息最初使用两个 Element Plus 默认 `el-dialog`，只是数据展示，和壳层交互语言不一致。

重做：

- 改为右侧账户中心抽屉。
- 顶部：头像、姓名、角色、数据范围、企业名称。
- 中间：个人信息 / 企业信息双 Tab。
- 个人信息：基本资料、组织与权限两个分区。
- 企业信息：企业资料、当前组织上下文两个分区。
- 底部：退出登录危险动作。
- 自定义打开、Tab 切换、hover、关闭、退出按钮和响应式排版。
- 通知中心继续保留，铃铛、未读数、通知列表和已读更新不受影响。

证据：`output/playwright/designer-business-workbench/account-drawer-1440x900.png`

---

## 消息中心重做（2026-10-08）

原因：通知最初是 Element Plus Popover + 简单列表，只满足“能看通知”，没有成为完整消息中心。

重做：

- 铃铛点击改为右侧消息中心抽屉。
- 顶部：铃铛、消息通知标题、未读数。
- 筛选：全部 / 未读；全部类型 / 客户 / 项目 / 报价 / 系统等动态类型。
- 消息卡：类型图标、类型标签、时间、标题、正文、未读点。
- 操作：单条点击标记已读并进入对象；全部已读；加载/失败/空态。
- 底部：仅展示最近 20 条。
- 与账户中心使用同一右侧抽屉、身份头部、卡片分区和按钮语言。

浏览器验证：铃铛、消息抽屉、2 条消息、2 条未读、未读筛选、类型筛选、全部已读入口均存在。

---

## 账户与消息改为 Layout 路由页（2026-10-08）

调整原因：账户信息和消息通知不属于快速处理抽屉，传统企业工作台应在 Layout 内容区通过 route 展示。

新路由：

- `/account/profile`：个人信息
- `/account/company`：企业信息
- `/messages`：消息通知

交互调整：

- 顶栏用户菜单点击个人信息/企业信息直接路由到对应页面。
- 顶栏铃铛点击直接进入 `/messages`。
- 页面继续使用角色 Layout、侧栏和顶栏，内容区渲染账户或消息页面。
- 移除账户/消息抽屉组件，避免两套交互。

截图：

- `output/playwright/designer-business-workbench/account-route-1440x900.png`
- `output/playwright/designer-business-workbench/messages-route-1440x900.png`
