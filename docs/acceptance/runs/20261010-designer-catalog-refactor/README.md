# 设计师报价项目库 Web 重构验证

> 批次：`DESIGNER-CATALOG-20261010`
> 状态：研发验证完成，待独立业务验收
> 日期：2026-10-10
> 环境：Web `http://127.0.0.1:8080`；后端 dev `http://127.0.0.1:8090`；设计师只读账号

## 1. 范围与边界

- 页面：`/designer/catalog`，设计师/BOSS 共用只读检索能力。
- 业务边界：只展示销售侧口径；标准成本、采购执行价、供应商历史价和利润不下发、不展示。
- 页面原型：D 专业列表，首屏回答“报价分项属于什么类型/分类，销售价如何构成，工艺与计价口径是什么”。
- 不包含：报价项目库维护、报价分项新增/编辑/删除、成本或利润展示。

## 2. 本轮修正

1. 页面改为“类型/分类导航 + 服务端分页专业列表 + 详情面板/1024 抽屉”。
2. 列表按服务端分页读取，单页 30 条，不再固定拉取 200 条后静默截断。
3. 品牌、系列、规格按“分类 → 品牌 → 系列 → 规格”层级联动。
4. 修正 `catalog/item/tree` 前端解析与后端投影：
   - 白名单补齐 `seriesByBrand`、`specsBySeries`；
   - 空缺品牌/系列/规格不再伪装成“其他”，避免精确查询返回 0。
5. 增加请求序号保护、失败恢复、真实空态、筛选 URL 恢复和 1024 详情抽屉。
6. 去除页面上面向管理者的“只读检索、销售价口径、成本/采购/利润说明”等无关文案。
7. 详情支持 `CatalogItem.images`：选中分项后按需签发 `Catalog` 私有图片 URL，以缩略图网格展示并可点击放大、左右切换。
8. 销售价按计价方式展开：
   - 材料+人工：材料价 + 人工价；
   - 仅材料/仅人工：只展示对应价格；
   - 固定总价：优先展示 `fixedTotalPrice`；历史记录缺该字段时按后端 `QuoteCalcContext` 兼容口径回退材料价 + 人工价，并标识“历史兼容”。

## 3. 验证证据

### 3.1 自动化

- `mvn -q -Dtest=CatalogTreeProjectionTest test`：PASS。
- `npm run build`：PASS。
- `npm run check:forms|concepts|states|actions|metrics|permissions|page-system|workbenches|workspaces`：PASS。
- 指标检查保留既有警告：设计师/门店报表分母与 `MET-001` 口径不一致，不属于本页改动。

### 3.2 真实浏览器

- 1440x900：`output/playwright/designer-catalog-20261010/v2/catalog-1440.png`
- 1280x800：`output/playwright/designer-catalog-20261010/v2/catalog-1280.png`
- 1024x768：`output/playwright/designer-catalog-20261010/v2/catalog-1024.png`
- 1024 详情抽屉：`output/playwright/designer-catalog-20261010/v2/catalog-1024-drawer.png`
- 控制台：0 error / 0 warning。
- 三档均无页面横向溢出。

### 3.3 图片展示与预览

- 本地 `catalog_item_images` 暂无样图，使用真实 `el-image` 组件 + Mock 分页/签发响应验证。
- 详情出现“效果图片”网格，图片加载成功后可点击进入查看器。
- 查看器真实打开，图片自然尺寸 `800x600`，控制台 0 error / 0 warning。
- 证据：`output/playwright/designer-catalog-20261010/images/catalog-image-preview-1440.png`、`output/playwright/designer-catalog-20261010/images/catalog-images-no-manager-copy-1440.png`。
- 当前为组件能力验证，不代表企业真实图片素材验收。

### 3.4 交互核对

- 施工 → 油漆：结果 7 项。
- 油漆 → 三棵树：结果 2 项，品牌选项为真实品牌，不再出现无法查询的合成“其他”。
- 关键词 `MH-CON-16`：结果 1 项。
- 第 2 页：首行 `MH-CON-156`；直接打开 `?type=construction&page=2` 能恢复同页数据。
- 1024 点击列表行：对应项目详情抽屉可打开。
- 页面正文不再出现“只读检索”“销售价口径”“标准成本/采购执行价/利润”等无关文案。

## 4. 未覆盖

- 未做独立验收账号、跨租户负向和 BOSS 视角差异验收。
- 未做生产环境部署与冒烟。
- 未做网络断开、接口 500、会话过期的专项故障注入；页面已按规范提供“暂不可确认/重试”状态。
