# 跨角色对账（可对账项）

本次仅设计师角色登录，跨角色对账只能做「同一事实在本角色多视图一致性」与「DB 对账」。

| 事实 | 设计师视图 | 服务端/DB | 一致性 |
| --- | --- | --- | --- |
| 客户 周敏 13910008888 / 璟阳里 5栋804室 / 预算 126,507 | 客户列表、客户 360、量房任务卡 | `cust_customer`：name/tel_no/community/addr/area=100/budget=126507/status=Quoted/emp_id/designer_id | 一致（✅）；但量房/设计抽屉摘要显示「待补充」（❌ XA-002） |
| 房屋状态 | 房屋卡「待量房」→ 量房后「已量房」 | `db_property.status=Quoted`（报价后推进） | 页面与 DB 分别表达「量房状态」与「业务状态」，需注意口径（观察） |
| 量房事实 | 任务「已预约→量房完成·待交设计」、量房日期 2026-10-12 10:30 | `db_measure.status=Completed`、scheduled_at=completed_at=2026-10-12 10:30 | 一致（✅） |
| 区域实测 | 客餐厅 15.6㎡/16.4m、卧室1 11.8㎡/14.1m（来源=实测） | `db_design_space`：15.60/16.40、11.80/14.10、area_source=Measured | 一致（✅） |
| 方案面积 | 方案摘要区 | `db_design.area=27.40` = 15.60+11.80 | 一致（✅） |
| 设计分项金额 | ¥57.60 + ¥3,240.00 = ¥3,297.60 | `db_design_item.amount` 57.60 / 3240.00 | 一致（✅） |
| 报价金额 | 报价工作区 V1 ¥3,462.48 | `quote`：subtotal=3297.60、discount=1.0、amount=3462.48（×1.05 税） | 一致（✅） |
| 报价状态 | 「待客户确认」 | `quote.status=Submitted` | 一致（✅） |
| 合同 | 无 | `db_project_contract` = 0 | 一致（✅，链路止于报价） |
| 项目 | 无 | `db_project` = 0 | 一致（✅） |

## 跨端（App/Web）对账

- NOT_TESTED：本次为 Web 单端审计，未登录 App 对照同一客户/方案/报价。
