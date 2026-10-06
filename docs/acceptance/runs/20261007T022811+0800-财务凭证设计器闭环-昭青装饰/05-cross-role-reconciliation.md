# 页面、接口、数据库对账

| 业务键 | 页面 | 接口 | 数据库 | 结论 |
| --- | --- | --- | --- | --- |
| 企业模板 `工资发放凭证` | 我的模板中显示 V2 / 已发布 V2 | save 200；publish 200 | `template_id=233295264289390592`，version=2，published_version=2 | PASS |
| 保存配置 | 标题字号 22，下边框选中 | save 请求携带 designerConfig | `elements[1].style.fontSize=22`，`border.bottom=true` | PASS |
| 版本历史 | V2 发布时间 02:36:16；V1 发布时间 02:32:05 | version/page 200 | V2 Published；V1 Superseded | PASS |
| JSON 存储 | 可正常重载 | 列表响应可解析 | 四个 JSON 列均为 LONGTEXT | PASS |

> 本轮只有 Finance 一个业务角色参与，无跨角色数据交接结论。
