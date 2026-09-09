import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const e2eSecret = "e2e-browser-secret";
const demoPassword = process.env.E2E_DEMO_PASSWORD || "e2e-only-password";
const seed = String(Date.now() % 1_000_000).padStart(6, "0");

function phone(projectName: string, offset: number) {
  const projectDigit = projectName.startsWith("mobile") ? 2 : 1;
  const tail = String((Number(seed) + offset) % 1_000_000).padStart(6, "0");
  return `139${projectDigit}${projectDigit}${tail}`;
}

async function testCode(request: APIRequestContext, target: string, purpose: "REGISTER" | "LOGIN") {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request.get(`/api/test/sms-code?phone=${target}&purpose=${purpose}`, { headers: { "x-e2e-secret": e2eSecret } });
    if (response.ok()) return (await response.json() as { code: string }).code;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`测试验证码未写入：${purpose}`);
}

async function passwordLogin(page: Page, target = "/") {
  await page.goto(`/login?next=${encodeURIComponent(target)}`);
  await page.getByLabel("手机号").fill("13800000001");
  await page.getByLabel("密码").fill(demoPassword);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
}

test.describe.serial("认证", () => {
  test("未登录跳转、密码错误和安全 next 回跳", async ({ page }) => {
    await page.goto("/work");
    await expect(page).toHaveURL(/\/login\?next=%2Fwork$/);
    await page.getByLabel("手机号").fill("13800000001");
    await page.getByLabel("密码").fill("incorrect-password");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page.getByText("手机号或密码错误", { exact: true })).toBeVisible();
    await page.goto("/login?next=https%3A%2F%2Fevil.example");
    await page.getByLabel("手机号").fill("13800000001");
    await page.getByLabel("密码").fill(demoPassword);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("密码登录后按站内目标回跳", async ({ page }) => {
    await passwordLogin(page, "/work");
    await expect(page.getByRole("heading", { name: "我的订单" })).toBeVisible();
  });

  test("注册页面发送验证码并创建发单者", async ({ page, request }, testInfo) => {
    const target = phone(testInfo.project.name, 1);
    await page.goto("/register");
    await page.getByLabel("姓名").fill("端到端发单者");
    await page.getByLabel("手机号").fill(target);
    await page.getByLabel("密码").fill("register-password");
    await page.getByRole("button", { name: "获取验证码" }).click();
    await expect(page.getByRole("status")).toContainText("验证码已发送");
    await page.getByLabel("短信验证码").fill(await testCode(request, target, "REGISTER"));
    await page.getByRole("button", { name: "注册并进入" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "订单大厅" })).toBeVisible();
  });

  test("创作者注册和短信登录，验证码不可复用", async ({ page, request }, testInfo) => {
    const target = phone(testInfo.project.name, 2);
    await page.goto("/register");
    await page.getByLabel("姓名").fill("端到端创作者");
    await page.getByLabel("身份").selectOption("CREATOR");
    await page.getByLabel("手机号").fill(target);
    await page.getByLabel("密码").fill("register-password");
    await page.getByRole("button", { name: "获取验证码" }).click();
    await page.getByLabel("短信验证码").fill(await testCode(request, target, "REGISTER"));
    await page.getByRole("button", { name: "注册并进入" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.context().clearCookies();

    await page.goto("/login");
    await page.getByRole("tab", { name: "验证码登录" }).click();
    await page.getByLabel("手机号").fill(target);
    await page.getByRole("button", { name: "获取验证码" }).click();
    const code = await testCode(request, target, "LOGIN");
    await page.getByLabel("短信验证码").fill(code);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.context().clearCookies();
    const reused = await request.post("/api/auth/sms/login", { data: { phone: target, smsCode: code } });
    expect(reused.status()).toBe(400);
  });

  test("验证码错误、过期和重复发送限流", async ({ request }, testInfo) => {
    const wrongPhone = phone(testInfo.project.name, 3);
    expect((await request.post("/api/auth/sms/send", { data: { phone: wrongPhone, purpose: "REGISTER" } })).status()).toBe(200);
    const wrong = await request.post("/api/auth/register", { data: { name: "错误验证码", role: "CLIENT", phone: wrongPhone, password: "register-password", smsCode: "000000" } });
    expect(wrong.status()).toBe(400);
    const limited = await request.post("/api/auth/sms/send", { data: { phone: wrongPhone, purpose: "REGISTER" } });
    expect(limited.status()).toBe(429);
    expect(limited.headers()["retry-after"]).toBeTruthy();

    const expiredPhone = phone(testInfo.project.name, 4);
    await request.post("/api/auth/sms/send", { data: { phone: expiredPhone, purpose: "REGISTER" } });
    const expiredCode = await testCode(request, expiredPhone, "REGISTER");
    await new Promise((resolve) => setTimeout(resolve, 12_500));
    const expired = await request.post("/api/auth/register", { data: { name: "过期验证码", role: "CLIENT", phone: expiredPhone, password: "register-password", smsCode: expiredCode } });
    expect(expired.status()).toBe(400);
  });
});
