# src — Web 实现与界面规范

> 根 `AGENTS.md` 同时生效。本文件只约束 `src/**`；完整视觉和业务规则以 `docs/standards/**` 为准。

## 1. 技术栈

- Vue 3 + TypeScript + Vite + Element Plus + Pinia。
- 页面和组件统一使用 `<script setup lang="ts">`；禁止 Options API 和无理由 `any`。
- 视觉 Token 唯一真源是 `src/styles/tokens.scss`；禁止在页面复制新的品牌色、字号、圆角和阴影体系。
- 日期、金额、状态和枚举使用项目已有格式化与注册机制，不新增同义实现。

## 2. 数据与 Provider

- 页面只调用对应 `src/domains/<domain>/api.ts`，禁止直接拼 URL、直接 `axios` 或新开同义 Provider。
- 增长型列表必须服务端分页，默认 `size=20`，普通列表和选择器硬上限 `50`；禁止固定 `100/200/500`。
- 搜索、筛选、排序在服务端执行；禁止只筛选当前页。
- 金额、计数、比例、排行、趋势必须消费后端 `report/summary/overview`；禁止 `reduce`、`filter().length` 或 `groupBy` 生成正式指标。
- 接口失败显示“暂不可确认”和恢复路径；禁止用 `0`、空数组、Mock 或本地常量伪装事实。

## 3. 角色、路由与工作台

- 角色准入：`src/roles/routes.ts`。
- 角色菜单：`src/roles/workbenchConfig.ts`。
- 角色首页场景卡片：`src/roles/workbenchHome.ts`。
- 业务条款：`docs/standards/WEB-工作台契约条款.md`。
- 新增或修改入口只改上述静态源，不引入运行时角色注册表、`roles: []` 过滤或深链接角色判断。
- 工作台必须是“入站队列 + 对象工作面 + 唯一主行动 + 完成后去向/接棒人”；一级导航不超过 7 项。
- 多入口必须同对象锚点、同状态源、同允许动作；从工作台进入对象后不得再次搜索同一对象。

## 4. 状态与动作

- 状态标签使用统一业务状态组件；未登记状态显示“待业务确认”。
- 下一步、阻断原因、责任人和完成后状态必须消费服务端动作视图，不在页面按 `status/stage` 自行拼装。
- 动作完成后按 `reloadScopes` 回读；失败显示部分数据暂不可确认。
- 角色页面必须有真实入口、真实前置条件和完成后交接，不得只做孤立页面。

## 5. 表单与选择器

- 员工、项目、客户、房屋、报价、合同、工人、供应商、应收应付等业务对象必须使用专用选择器；禁止 `el-select/filterable` 或原生下拉承载增长型业务对象。
- 选择器打开即展示数据，提供服务端搜索分页、加载/空/失败/无权限/失效状态、选择/清除/取消和一次性回传。
- 来源页面使用全宽已选业务卡，展示名称、状态和关键业务事实，不显示“已选择某某”。
- 账务分类使用树形选择；报价分项选择器保留分类/品牌/规格/区域和多选数量。
- Element Plus 使用简体中文 locale；日期、星期和默认文案不得出现英文。

## 6. UI 与交互

- Web UI 使用 `zhuangdeqing-ui-craft`；真实页面必须覆盖七态、可访问性、键盘操作和三档渲染。
- 页面必须建立在稳定 Token、既有组件和工作台母型上；不创建第二套设计语言。
- 数字、金额、数量和面积使用等宽数字；金额和成本缺失不得显示伪 0。
- 删除、付款、确认、签约、权限变更等高风险动作必须有明确前置、二次确认、失败恢复和回读。
- 只有静态样式或构建通过不算视觉完成；必须有真实浏览器证据。

## 7. 验证命令

按改动范围执行，至少包括：

```bash
npm run type-check
npm run build
npm run check:forms
npm run check:concepts
npm run check:states
npm run check:actions
npm run check:metrics
npm run check:permissions
npm run check:page-system
npm run check:workbenches
npm run check:workspaces
npm run check:identifier-exposure
```

涉及选择器、分页、角色入口、金额/权限或跨端事实时，补对应负向样本和真实浏览器证据。只运行 `build` 不足以证明业务闭环。
