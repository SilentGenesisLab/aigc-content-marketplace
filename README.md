# 片场：AIGC 内容创作与交付平台

面向中国境内营销短视频的真实协作与履约平台。连接发单者、创作者和平台管理员，覆盖标准 Brief、公开报名、中选、Brief 确认、版本交付、结构化修改、验收、AIGC 合规声明、权利确认和真实评价。

## 技术栈

- Next.js 16 App Router + TypeScript
- PostgreSQL + Prisma 6
- Redis（登录、短信限流与缓存失效）
- 阿里云短信（注册验证与验证码登录）
- Alibaba Cloud OSS（交付文件上传）
- Playwright（桌面端与移动端完整流程测试）
- Docker Compose

## 本地启动

1. 复制 `.env.example` 为 `.env`，填写随机的数据库、会话与短信摘要密钥，以及阿里云短信配置。
2. 启动依赖：`docker compose up -d postgres redis`。
3. 运行迁移和种子：`npm run db:deploy && npm run db:seed`。
4. 启动：`npm run dev`。

演示种子账户手机号分别为 `13800000001`（发单者）、`13800000002`（创作者）和 `13800000003`（管理员），密码由部署环境的 `DEMO_PASSWORD` 注入，不进入仓库。生产环境应删除演示账户。

注册必须验证中国大陆手机号。验证码为 6 位数字、5 分钟有效且只能使用一次；密码登录和验证码登录均可使用。生产环境不会启用测试验证码或万能验证码。

## 真实业务规则

- 平台不制造成交量、准时率或评价；无真实数据时明确展示空状态。
- 中选创作者必须显式确认冻结后的 Brief，才能进入制作。
- 修改必须指出不符合的验收条款并提供验证证据。
- 交付需声明 AI 工具、素材来源及人物、声音、品牌授权情况。
- 只有最终验收版本进入权利确认清单；未中选样稿和未验收版本不自动转移权利。
- 首周试运营不经手、不托管也不记录支付。

## 质量检查

```bash
npm run test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

`npm run test:e2e` 会构建隔离的 Docker 测试环境，执行 Prisma 迁移和种子数据，运行桌面与移动端 Playwright 流程，最后自动删除测试数据库和 Redis 卷。测试短信和文件适配器仅在 `APP_ENV=test` 时启用。
