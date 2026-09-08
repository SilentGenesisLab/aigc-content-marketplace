const base = process.argv[2] || "http://localhost:3000";
const sessions = {};
const checks = [];

async function request(path, { session, method = "GET", body, form } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(session && sessions[session] ? { cookie: sessions[session] } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : form,
  });
  const cookie = response.headers.get("set-cookie");
  if (session && cookie) sessions[session] = cookie.split(";")[0];
  const result = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${result.error || response.status}`);
  return result;
}

for (const [session, phone] of [["client", "13800000001"], ["creator", "13800000002"], ["admin", "13800000003"]]) {
  await request("/api/auth/login", { session, method: "POST", body: { phone, password: "Demo@123456" } });
}
checks.push("登录三类账户");

await request("/api/creator/profile", { session: "creator", method: "PATCH", body: { bio: "营销短视频创作者", skills: ["脚本", "视频制作"], platforms: ["抖音"], styles: ["产品种草"], available: true } });
checks.push("维护创作者档案");

const created = await request("/api/orders", { session: "client", method: "POST", body: { title: `端到端验收订单 ${Date.now()}`, objective: "验证平台真实履约闭环", topic: "AIGC 工具产品种草", quantity: 1, duration: "30 秒", platform: "抖音", aspectRatio: "9:16 竖屏", audience: "内容创作者", style: "真实测评", referenceUrls: [], forbiddenElements: "不得使用未授权品牌", deadline: new Date(Date.now() + 172800000).toISOString(), acceptanceCriteria: "1080P；时长 30 秒；AIGC 标识完整", mode: "MULTI_DELIVERY", slots: 1, sampleRequired: false } });
const orderId = created.order.id;
checks.push("创建标准 Brief");

await request(`/api/orders/${orderId}`, { session: "client", method: "PATCH", body: { action: "submit" } });
await request(`/api/orders/${orderId}`, { session: "admin", method: "PATCH", body: { action: "approve" } });
checks.push("平台审核并发布");

await request(`/api/orders/${orderId}/applications`, { session: "creator", method: "POST", body: { pitch: "具备相关产品短视频经验，可按时完成", portfolioIds: [] } });
const detail = await request(`/api/orders/${orderId}`, { session: "client" });
await request(`/api/orders/${orderId}/select`, { session: "client", method: "POST", body: { applicationIds: [detail.order.applications[0].id] } });
checks.push("报名、对比与中选");

const work = await request("/api/suborders", { session: "creator" });
const subOrder = work.subOrders.find((item) => item.orderId === orderId);
await request(`/api/suborders/${subOrder.id}/confirm`, { session: "creator", method: "POST", body: { confirmed: true } });
checks.push("创作者显式确认 Brief");

const uploadForm = new FormData();
uploadForm.set("file", new Blob(["AIGC marketplace end-to-end validation artifact."], { type: "text/plain" }), "qa-upload.txt");
const upload = await request("/api/uploads", { session: "creator", method: "POST", form: uploadForm });
checks.push("OSS 真实上传");

const delivery = (title, note) => ({ title, fileUrl: upload.url, note, aiTools: ["OpenAI"], materialSources: "自有测试素材", commercialLicense: true, portraitAuthorization: true, voiceAuthorization: true, brandAuthorization: true });
await request(`/api/suborders/${subOrder.id}/deliveries`, { session: "creator", method: "POST", body: delivery("初版交付", "首版") });
await request(`/api/suborders/${subOrder.id}/revision`, { session: "client", method: "POST", body: { criteria: "画面节奏需符合验收条款", evidence: "第 12 秒转场偏慢", note: "缩短转场并重新提交" } });
await request(`/api/suborders/${subOrder.id}/deliveries`, { session: "creator", method: "POST", body: delivery("最终修改版", "已调整转场") });
checks.push("版本交付与结构化修改");

await request(`/api/suborders/${subOrder.id}/accept`, { session: "client", method: "POST", body: { scope: "中国境内全渠道商业使用权", portfolioPermission: false, verification: "复核分辨率、时长、AIGC 标识和转场，全部通过" } });
await request(`/api/suborders/${subOrder.id}/reviews`, { session: "client", method: "POST", body: { rating: 5, comment: "按 Brief 完成交付，修改响应及时" } });
checks.push("验收、确权与真实评价");

const final = await request(`/api/orders/${orderId}`, { session: "client" });
if (final.order.status !== "COMPLETED" || !final.order.subOrders[0]?.rightsReceipt) throw new Error("完成状态或权利确认回读失败");
await request("/api/admin/dashboard", { session: "admin" });
checks.push("完成态回读与运营漏斗");

for (const item of checks) console.log(`PASS ${item}`);
