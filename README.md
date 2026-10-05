# th4-decoboon-web-v3

装得清 · 家装企业全角色 Web 经营工作台（V3 重建）。

## 快速开始

```bash
npm install
npm run dev        # http://127.0.0.1:8092（需后端 8090 已启动）
npm run type-check
npm run build
```

后端：在同级 `../../后端代码/th4-decoboon` 执行 `./run-dev.sh`。

## 目录

```text
AGENTS.md            工程总规范（必读）
.agents/skills/      项目智能体（product / ui / arch / acceptance / reviewer）
docs/product/        产品定位、信息架构、设计系统、组件、页面门禁
docs/development/    前端工程规范、Provider 契约
docs/acceptance/     渲染验收与沉浸审计协议、验收运行目录
docs/knowledge/      V1/V2 归档索引（旧工程只读引用）
_系统/                当前项目、当前工作、协作约定
src/                 前端实现
```

## 与旧工程的关系

旧 `../th4-decoboon-web`（含 V1/V2）自 2026-10-06 起**冻结为只读知识库**，
不再承接新功能开发。可继承与不继承结论见 `docs/knowledge/V1-V2-ARCHIVE-INDEX.md`。

## 当前状态

工程骨架、登录与会话、角色壳层与导航、设计 Token、智能体与规范已就绪；
业务页面按角色分批重建，未接入前统一显示「建设中」。
