# 企业 Web 工作台首页 V2 · 交接

- 日期：2026-10-21
- 状态：代码完成、构建与工作台门禁通过、模拟负责人会话渲染通过，未发布
- 目标：让 Web 首页先给出“今日经营判断”，而不是先展示菜单或空待办。

## 改动文件

- `src/views/workbench/WorkbenchHomeView.vue`

## 页面变化

1. 新增“今日经营判断”区域。
2. 按角色提供不同判断文案：
   - 企业负责人
   - 店长
   - 团队负责人
   - 业务员
   - 设计师
   - 项目经理
   - 财务
3. 今日关注卡片只从 `src/roles/workbenchHome.ts` 现有静态场景清单中取 P0 入口，不新增第二套工作台注册表。
4. 卡片展示场景、对象任务与主行动，点击进入现有可达路径。
5. 没有服务端事实时不显示 0、不构造假待办；原“需要我处理”场景卡片继续保留。
6. 保留一人装企岗位视角切换与原身份、数据范围、审计主体边界。

## 事实边界

- 不新增 API。
- 不新增业务状态、指标、权限或金额判断。
- 今日卡片是现有场景入口的重组，不是服务端待办数量。
- 所有动作仍进入既有角色可达路径，由服务端状态机和权限裁决。
- 成本不完整时利润口径不变。

## 验证

```text
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
```

全部通过。

模拟企业负责人会话：

- 1440 / 1280 / 1024 三档均无横向溢出。
- “今日经营判断”渲染 3 个 P0 场景入口。
- 渲染截图：
  - `docs/previews/workbench-home-v2-20261021.png`

## 待后续

- 使用真实登录账号在目标环境走查各角色视角。
- 按批次把真实待办数量接入时，必须继续遵守“未返回事实前不显示 0”的规则。
- 正式发布仍需用户明确授权。
