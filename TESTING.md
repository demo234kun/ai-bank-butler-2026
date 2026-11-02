# 测试与验证

本仓库的测试分四层：单元测试、冒烟、浏览器回归、线上 Demo 验收。全部使用合成数据，不连接真实银行、短信或人脸服务。

## 1. 一键运行

```bash
npm install
npm test              # 10 个文件 / 124 个用例
npm run smoke         # 临时服务 + 离线规则
npm run smoke:bank    # 六场景经 HTTP 银行核心适配层
npm run smoke:full    # 银行 + 短信 + 人脸均经 HTTP Provider
node tools/qa-product.mjs      # 生产构建 + headless Chrome 交互回归
node tools/qa-pure-product.mjs # 纯产品版页面检查
```

最近一次结果（2026-11-02）：`npm test` 124/124 通过，耗时 3.4 秒。

## 2. 单元测试

位置：`apps/server/test/`，使用 Vitest。

| 文件 | 用例 | 覆盖内容 |
| --- | ---: | --- |
| `policy.test.ts` | 21 | 五档判定、金额档、当日累计、拒绝边界、额度台账、一次性授权 |
| `nlu.test.ts` | 34 | 规则兜底、意图与槽位归一化、提示词注入、数字一致性守卫 |
| `safeguards.test.ts` | 12 | 风控智能体评分、收款人复述、档位融合、人工审核队列 |
| `planner.test.ts` | 11 | DAG 依赖排序、模板选择、节点失败处理 |
| `integration.test.ts` | 11 | HMAC 签名、时间窗、nonce、幂等、重试、快照 Zod 校验 |
| `risk.test.ts` | 9 | 风险测评评分与理财适当性 |
| `dispute.test.ts` | 9 | 争议资格、180 天窗口、工单状态流转 |
| `ledger.test.ts` | 7 | 预留-提交、并发串行化、过期回收 |
| `audit.test.ts` | 6 | 哈希链完整性、篡改检测、checkpoint |
| `templates.test.ts` | 4 | 18 个业务模板注册与匹配优先级 |

### 安全相关断言

- **权限只升不降**：静态档与风控档取较高值；单笔 > ¥200,000、当日 > ¥500,000 直接拒绝。
- **授权不可重放**：摘要含 `userId|sessionId|runId|nodeId|tool|args`；改参数返回 `DIGEST_MISMATCH`，二次使用返回 `GRANT_ALREADY_USED`，90 秒过期。
- **注入拦截**：命中系统提示、越权工具、伪造回执等话术即拒绝；连续命中触发 10 分钟熔断。
- **事实一致**：回复中的金额必须能在工具结果中找到，否则拦截。
- **审计防篡改**：修改任一条目后整链校验失败；checkpoint 每 50 条。
- **并发与额度**：同一用户写操作串行；`used = COMMITTED + HELD`，预留 120 秒自动回收。

## 3. 冒烟与端到端

| 命令 | 验证路径 |
| --- | --- |
| `npm run smoke` | 启动独立临时服务，访客登录 → 6 个场景 SSE → 审计链逐条校验 |
| `npm run smoke:bank` | 同上，银行读写全部经本地契约桩的 HTTP 适配层 |
| `npm run smoke:full` | 再叠加短信下发、人脸活体会话与服务端结果确认 |
| `npm run e2e` | 对已运行的服务执行完整对话流程（默认 `http://localhost:8787`） |
| `npm run bank:stub` | 单独启动银行契约桩，端口 8791 |

## 4. 浏览器回归

`tools/qa-product.mjs` 使用 headless Chrome 跑生产构建，覆盖 33 项：注册、登录、找回密码、访客进入、首页、对话、转账确认与回执、账单、卡片、风险测评、争议工单、语音输入、生物识别录入，以及控制台四档视口。

`npm run qa:pure` 检查纯产品版：页面不出现“演示 / 合成数据 / 模拟核心”等标注，控制台技术说明仍完整。

## 5. 线上 Demo 验收

地址：https://ai-bank-butler-ysiju3b1a09.qoder.zone

已执行并记录：

1. `/functions/v1/app/api/health` 返回 200，`llmMode=llm`。
2. 访客登录 200，Set-Cookie 正常；`/api/auth/me`、`/api/overview`、`/api/bootstrap` 均 200。
3. 对话走 SSE，能返回余额与账单卡片。
4. T1 转账：摘要确认 → “转账成功”回执，余额从 86,420.50 变为 85,900.50。
5. `/#/console` 可打开，审计链 380 条完整，无浏览器控制台报错。
6. 线上资源哈希与本地 `site/` 构建一致。

## 6. 边界

- 以上为开发期自测与线上功能验收，未做渗透测试、代码审计或第三方安全评估。
- 短信与人脸默认走 demo 通道；`smoke:full` 验证的是 HTTP 契约，不代表已通过行方准入。
- Demo 后端运行在本机，经 Cloudflare Quick Tunnel 代理；本机停机时线上验收不可复现。
- 完整风险清单与生产化建议见 [安全自评报告](docs/security-self-assessment.md)。
