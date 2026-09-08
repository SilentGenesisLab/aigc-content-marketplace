import { devices, expect, test, type Browser, type BrowserContext } from "@playwright/test";

const password = "e2e-only-password";

async function login(browser: Browser, phone: string, mobile: boolean) {
  const context = await browser.newContext(mobile ? devices["Pixel 7"] : devices["Desktop Chrome"]);
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("手机号").fill(phone);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  return { context, page };
}

async function closeAll(contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close()));
}

test("发单、审核、报名、中选、Brief、两版交付、验收和评价", async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const contexts: BrowserContext[] = [];
  const mobile = testInfo.project.name.startsWith("mobile");
  try {
    const client = await login(browser, "13800000001", mobile); contexts.push(client.context);
    const title = `Playwright 全流程订单 ${Date.now()}`;
    await client.page.goto("/orders/new");
    await client.page.getByPlaceholder("例：秋季新品种草短视频").fill(title);
    await client.page.getByPlaceholder("产品和核心主题").fill("AIGC 产品种草");
    await client.page.getByPlaceholder("希望解决什么问题，期望用户采取什么行动").fill("验证真实 UI 履约闭环");
    await client.page.getByPlaceholder("年龄、兴趣或消费场景").fill("内容创作者");
    await client.page.getByPlaceholder("例：真实测评、轻快口播").fill("真实测评");
    await client.page.getByPlaceholder("逐条说明分辨率、时长、内容和版权要求").fill("1080P；30 秒；AIGC 标识完整");
    await client.page.getByPlaceholder("不得出现的品牌、人物、表达或视觉元素").fill("不得使用未授权品牌");
    const deadline = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16);
    await client.page.locator('input[name="deadline"]').fill(deadline);
    await client.page.getByRole("button", { name: "保存为草稿" }).click();
    await expect(client.page).toHaveURL(/\/orders\/(?!new$)[^/]+$/);
    const orderUrl = client.page.url();
    await client.page.getByRole("button", { name: "提交平台审核" }).click();
    await expect(client.page.getByText("待审核", { exact: true })).toBeVisible();

    const admin = await login(browser, "13800000003", mobile); contexts.push(admin.context);
    await admin.page.goto("/admin");
    const pendingTitle = admin.page.getByText(title, { exact: true });
    await expect(pendingTitle).toBeVisible();
    await pendingTitle.locator("..").getByRole("button", { name: "通过并发布" }).click();
    await expect(admin.page.getByText(title)).toHaveCount(0);

    await client.page.reload();
    await expect(client.page.getByText("报名中", { exact: true })).toBeVisible();

    const creator = await login(browser, "13800000002", mobile); contexts.push(creator.context);
    await creator.page.goto(orderUrl);
    await creator.page.getByRole("button", { name: "报名这个订单" }).click();
    await creator.page.getByPlaceholder("说明你的相关经验、制作思路和可投入时间").fill("具备相关产品短视频经验，可按时完成");
    await creator.page.getByRole("button", { name: "确认报名" }).click();
    await expect(creator.page.getByText("你已报名该订单")).toBeVisible();

    await client.page.goto(orderUrl);
    await client.page.getByRole("checkbox").first().check();
    await client.page.getByRole("button", { name: /确认中选 1 人/ }).click();
    await expect(client.page.getByText("履约子订单")).toBeVisible();

    await creator.page.goto("/work");
    await creator.page.getByRole("button", { name: "确认 Brief 并开始" }).click();
    await expect(creator.page.getByText("制作中", { exact: true })).toBeVisible();
    await creator.page.getByRole("button", { name: "提交交付版本" }).click();
    await creator.page.getByPlaceholder("版本名称").fill("初版交付");
    await creator.page.locator('input[name="file"]').setInputFiles({ name: "first.txt", mimeType: "text/plain", buffer: Buffer.from("first delivery") });
    await creator.page.getByPlaceholder("本版说明").fill("首版");
    await creator.page.getByPlaceholder("使用的 AI 工具，以逗号分隔").fill("OpenAI");
    await creator.page.getByPlaceholder("素材来源和许可说明").fill("自有测试素材");
    await creator.page.getByLabel("素材可商用").check();
    await creator.page.getByLabel("人物肖像已授权").check();
    await creator.page.getByLabel("克隆声音已授权/未使用").check();
    await creator.page.getByLabel("品牌元素已授权/未使用").check();
    await creator.page.getByRole("button", { name: "提交版本与合规声明" }).click();
    await expect(creator.page.getByText("待验收", { exact: true })).toBeVisible();

    await client.page.goto("/work");
    await client.page.getByRole("button", { name: "退回修改" }).click();
    await client.page.getByPlaceholder("不符合的验收条款").fill("画面节奏需符合验收条款");
    await client.page.getByPlaceholder("验证证据或时间点").fill("第 12 秒转场偏慢");
    await client.page.getByPlaceholder("具体修改说明").fill("缩短转场并重新提交");
    await client.page.getByRole("button", { name: "确认退回" }).click();
    await expect(client.page.getByText("需修改", { exact: true })).toBeVisible();

    await creator.page.goto("/work");
    await creator.page.getByRole("button", { name: "提交修改版本" }).click();
    await creator.page.getByPlaceholder("版本名称").fill("最终修改版");
    await creator.page.locator('input[name="file"]').setInputFiles({ name: "final.txt", mimeType: "text/plain", buffer: Buffer.from("final delivery") });
    await creator.page.getByPlaceholder("本版说明").fill("已调整转场");
    await creator.page.getByPlaceholder("使用的 AI 工具，以逗号分隔").fill("OpenAI");
    await creator.page.getByPlaceholder("素材来源和许可说明").fill("自有测试素材");
    for (const label of ["素材可商用", "人物肖像已授权", "克隆声音已授权/未使用", "品牌元素已授权/未使用"]) await creator.page.getByLabel(label).check();
    await creator.page.getByRole("button", { name: "提交版本与合规声明" }).click();
    await expect(creator.page.getByText("待验收", { exact: true })).toBeVisible();

    await client.page.goto("/work");
    await client.page.getByRole("button", { name: "验收通过并确权" }).click();
    await client.page.getByPlaceholder("验收验证说明").fill("分辨率、时长、标识和修改项全部通过");
    await client.page.getByRole("button", { name: "确认验收与权利转移" }).click();
    await expect(client.page.getByText("已验收", { exact: true })).toBeVisible();
    await client.page.getByPlaceholder("基于真实履约写下评价").fill("按 Brief 完成交付，修改响应及时");
    await client.page.getByRole("button", { name: "提交评价" }).click();
    await expect(client.page.getByText(/权利确认：/).first()).toBeVisible();

    await admin.page.goto("/admin");
    await expect(admin.page.getByRole("heading", { name: "平台管理" })).toBeVisible();
    await expect(admin.page.getByText("已完成", { exact: true })).toBeVisible();
  } finally {
    await closeAll(contexts);
  }
});
