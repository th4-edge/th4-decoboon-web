# 分辨率与可访问性矩阵

## 横向溢出实测（`document.documentElement.scrollWidth / clientWidth / innerWidth`）

| 页面 | 1440x900 | 1280x800 | 1024x768 |
| --- | --- | --- | --- |
| 设计工作区 `/designer/design/:id` | 1440/1440/1440 ✅ | 1280/1280/1280 ✅ | 1024/1024/1024 ✅ |
| 报价工作区 `/designer/quotes/:id` | 1440/1440/1440 ✅ | 1280/1280/1280 ✅ | 1024/1024/1024 ✅ |
| 我的客户 `/designer/my-customers` | 1440/1440/1440 ✅ | 1280/1280/1280 ✅ | 1024/1024/1024 ✅ |
| 项目工地 `/designer/projects` | 1440/1440/1440 ✅ | 1280/1280/1280 ✅ | 1024/1024/1024 ✅ |

截图：`raw/screenshots/res-{1440x900,1280x800,1024x768}-{design,quote,customers,projects}.png`；原始输出：`raw/notes/viewport-overflow.txt`。

## 可访问性观察

- ✅ 主要动作、表格、下拉多为语义化元素（button/textbox/spinbutton/combobox/option 可见）。
- ❌ 「选择报价分项」内「归属区域」下拉选项未出现在可访问性树；「上门时间」下拉需键盘试错（XA-007）。
- ❌ 在分项卡上误用方向键/回车会取消已选分项；Escape 关闭整个选择器且丢失已选（XA-007）。
- 未做完整键盘走查（仅上述路径），标记 NOT_TESTED 之外的部分未覆盖。
