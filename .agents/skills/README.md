# 装得清 Web V3 项目智能体

本目录定义 `th4-decoboon-web-v3` 的项目级智能体。所有智能体共同遵守：

1. 业务事实只能来自全局 `zhuangdeqing-business` 与规范业务库，本工程不得自建第二套业务口径。
2. 交付必须绑定真实浏览器证据；类型检查与构建成功不构成页面可用证据。
3. 未经 G1 / G1.5 冻结不得编码；未经 G3 不得表述为「页面已完成」。
4. 原始证据写入 `docs/acceptance/runs/<run-id>/`，不可覆盖。

| 智能体 | 职责 |
| --- | --- |
| `decoboon-web-product` | 产品推演、场景冻结、信息架构、迭代包 |
| `decoboon-web-ui` | 视觉与交互设计、组件规范、渲染后批判 |
| `decoboon-web-arch` | 工程架构、路由/状态/请求、性能与守卫 |
| `decoboon-web-acceptance` | 真实浏览器渲染验收、全角色沉浸审计 |
| `decoboon-web-reviewer` | 中小装企视角独立审查 |
