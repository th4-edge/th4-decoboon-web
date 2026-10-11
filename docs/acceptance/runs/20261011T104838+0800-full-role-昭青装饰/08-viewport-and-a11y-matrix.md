# 分辨率与可达性矩阵

## 分辨率（`resize` 后必须 `reload`，否则视口不生效——本次踩过这个坑，已按修正方法测量）

| 页面 | 1440×900 | 1280×800 | 1024×768 |
| --- | --- | --- | --- |
| `/finance/workbench` | ✅ 无溢出 | ✅ 无溢出 | ✅ 无溢出 |
| `/finance/ledger` | ✅ 无溢出 | ✅ 无溢出 | ✅ 无溢出 |
| `/finance/employee-salaries` | ✅ 无溢出 | ✅ 无溢出 | ✅ 无溢出 |
| `/finance/voucher-templates` | ✅ 无溢出 | ✅ 无溢出 | ✅ 无溢出 |

判定：`document.documentElement.scrollWidth === window.innerWidth`（允许 2px 容差），12/12 组全部通过。

> 方法学记录：`playwright-cli resize` 单独调用**不改变视口**，必须 `resize → reload` 才生效；
> 第一次测量得到的 `innerWidth` 始终是上一次的值，属**测量方法错误**，不是应用缺陷（已修正后重测）。

## 键盘可达性

| 项 | 结果 | 说明 |
| --- | --- | --- |
| Tab 进入导航 | ✅ | 首焦点落在「业务工作台」导航链接 |
| 主操作可键盘到达 | ⚠️ **PARTIAL** | 未逐页验证「登记收款」等主按钮的 Tab 顺序与 Enter 激活 |
| 抽屉/弹窗 Esc 关闭 | ❌ **NOT_TESTED** | 本次未打开抽屉/弹窗（read-only，避免触发写入口） |
| 焦点归还 | ❌ **NOT_TESTED** | 同上 |

> 未做原因：完整 a11y 走查需要触发抽屉/弹窗，而多数抽屉含写操作入口；在 read-only 形态下只做导航级抽查，并如实标注。
