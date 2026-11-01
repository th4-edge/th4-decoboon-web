# docs — Web 标准、产品与验收文档

> 根 `AGENTS.md` 同时生效。本目录不定义业务事实，不得用当前页面行为反推业务规则。

## 1. 第一性依据

- 建设公理：`docs/standards/WEB-建设核心思路.md`
- 开发总纲：`docs/standards/WEB-开发规范.md`
- 列表分页与汇总：`docs/standards/WEB-列表分页与汇总数据规范.md`
- 选择器与表单：`docs/standards/WEB-业务选择器与表单设计规范.md`
- 业务概念：`docs/standards/WEB-业务概念全生命周期规范.md`
- 状态机：`docs/standards/WEB-业务状态机与闭环一致性规范.md`
- 动作：`docs/standards/WEB-业务动作与闭环注册规范.md`
- 状态引导：`docs/standards/WEB-业务状态引导组件与接入规范.md`
- 指标与权限：`docs/standards/WEB-业务指标与权限注册规范.md`
- 页面系统：`docs/standards/WEB-业务页面系统注册规范.md`
- 工作台：`docs/standards/WEB-场景驱动工作台与多起点导航规范.md`、`docs/standards/WEB-沉浸式对象工作空间规范.md`、`docs/standards/WEB-工作台设计构建规范.md`

业务事实仍以 `zhuangdeqing-business` 为唯一来源。

## 2. 文档纪律

- 新增或修改业务页面、动作、状态、指标、权限或选择器前，先引用正式 `BR/DEC/OBJ/MET/GAP` 或取得 `T06/T12`。
- 文档必须区分事实、规则、设计建议、实现状态和验收结论。
- 不再新增历史流水型“当前工作”；当前状态只写 `_系统/`，变更使用 `CHG-*`，验收使用 RUN。
- 旧文档和旧 Agent 已归档到 `_系统/归档/20261102/`，不得作为当前依据。
- 标准之间冲突时建立 `GAP`，不得静默合并成新口径。

## 3. 验收文档

- 真实页面证据必须包含角色、租户、路径、分辨率、代码提交、操作步骤、网络摘要和对账结果。
- 页面、Provider、数据库只用于核验，不得用接口调用替代页面业务动作。
- 静态检查、类型检查和构建只证明工程健康，不证明页面完成或业务验收。
- 金额、权限、状态、跨端差异必须给正向、反向和越权证据。
