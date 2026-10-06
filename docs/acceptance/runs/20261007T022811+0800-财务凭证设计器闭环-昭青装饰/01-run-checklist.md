# 运行清单

| 项目 | 结果 |
| --- | --- |
| Web/后端同环境 | PASS |
| Finance 身份与企业范围 | PASS：吴濛濛 / 昭青装饰 / Company |
| 高级设计器渲染 | PASS |
| 保存 V2 | PASS |
| 发布 V2 | PASS |
| 数据库模板与版本落库 | PASS |
| 控制台 error/warning | PASS：0/0 |
| 三档截图 | NOT_TESTED：测试会话在后端重启后失效，未修改凭证绕过 |
| PDF 打印核验 | NOT_TESTED |
| 移动端 App 高级设计器 | NOT_TESTED，本轮范围为 Web |

## 构建

- Web：`npm run type-check` PASS；`npm run build` PASS。
- App：`npm run type-check` PASS；`npm run build:mp-weixin` PASS。
- 后端主代码：`mvn -q -DskipTests compile` PASS；`mvn -q -Dmaven.test.skip=true package` PASS。
- 后端定向测试：本轮干净重编译受 IDE 并发构建占用影响，未取得可信结果，标记 `NOT_TESTED`，不得宣称通过。
