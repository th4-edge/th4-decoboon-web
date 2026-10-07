# Web 全角色壳层与导航收口（DEF-WEB-001 侧栏接线）

- 日期：2026-10-07
- 类型：`REAL_BROWSER_NAV_REGRESSION`（真实浏览器 + 真实账号 + 本地真实库）
- 用户裁决：**Boss 点「财务经营」= 以负责人身份在负责人壳内看财务**（不进入财务角色壳）
- 环境：Web `http://127.0.0.1:8080`（Vite dev），后端 `http://127.0.0.1:8090`（dev，真实库 `/usr/local/mysql/data`）

## 1. 改动

| 项 | 内容 |
| --- | --- |
| 单一导航源 | 新增 `sidebarNavForRole(role)`（`src/domains/workbench/navigation.ts`），侧栏一级领域/二级场景工作台全部来自 `docs/standards/workbench-navigation.json` |
| 删除第二套菜单 | `src/roles/permission.ts` 移除 `MANAGEMENT_NAV` / `EXECUTION_NAV` / `ROLE_NAV_KEYS` / `navFor`，只保留角色标签、数据范围、首页判定 |
| 去掉「建设中」 | `WorkbenchLayout` 不再渲染 `planned` 徽标；不可达路由（404 兜底）与当前角色无权进入的路由不展示 |
| 壳层按角色裁决 | 新增 `src/layouts/RoleAreaShell.vue`；`/workbench`、`/designer`、`/pm`、`/finance` 四个路由组统一使用它。Boss 在任何业务域都留在负责人壳；设计师/项目经理/财务保持各自岗位壳 |

## 2. 真实浏览器回归（每个侧栏入口逐个点开）

| 角色 | 侧栏入口数 | 结果 |
| --- | --- | --- |
| Boss | 11 | 全部 OK；`/designer/*` 与 `/finance/*` 均在负责人壳渲染 |
| StoreManager | 4 | 全部 OK |
| TeamLeader | 3 | 全部 OK |
| Marketer | 2 | 全部 OK |
| Designer | 7 | 全部 OK，仍为设计师壳 |
| Pm | 5 | 全部 OK，仍为项目经理壳 |
| Finance | 15 | 全部 OK，仍为财务壳 |

判定标准：目标页无「页面不存在」、无「无权访问」；壳层与登录角色一致。

### Boss 侧栏（改动后）

```text
今日主线 / 团队经营概览 / 客户跟进 / 待我报价 / 待我设计 / 合同交接 /
待我处理增减项 / 待我付款 / 待我收款 / 资金台账与凭证 / 待我处置风险
```

### 店长侧栏（改动前 5 项全部「建设中」→ 改动后 4 项真实入口）

```text
今日主线 / 客户跟进 / 资金台账与凭证 / 待我处置风险
```

## 3. 门禁

- `npm run type-check` PASS
- `npm run build` PASS
- `npm run check:forms|concepts|states|actions|metrics|permissions|page-system|workbenches|workspaces` 9 项全部通过

## 4. 未覆盖 / 遗留

- `DEF-WEB-002/003`：对象工作空间上下文连续、多入口一致性与完成后交接未验证（本次只验证菜单可达与壳层归属）。
- `DEF-WEB-006`：四个壳层仍未收敛为 `RoleShellLayout`；设计师/PM/财务壳导航为 `button` + JS 路由，无可复制 href，不能新标签页打开。
- `DEF-WEB-007`：注册表角色范围与路由 `meta.roles` 不一致（如 TeamLeader 风险、店长应收/应付入口），当前按「不可达不展示」处理，待业务裁决。
- `DEF-WEB-008`：`WorkbenchHomeView` 未消费 `nav`/`surface` 深链接参数。

## 5. 截图

`screenshots/before-*.png`（改动前）、`screenshots/after-*.png`（改动后），1440×900。
