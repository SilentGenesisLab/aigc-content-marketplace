import { jsonError } from "@/lib/api";
import { normalizePhone, parseSmsPurpose, readTestSmsCode } from "@/lib/sms";

export async function GET(request: Request) {
  try {
    const secret = request.headers.get("x-e2e-secret");
    if (!process.env.E2E_TEST_SECRET || secret !== process.env.E2E_TEST_SECRET) {
      return new Response(null, { status: 404 });
    }
    const url = new URL(request.url);
    const code = await readTestSmsCode(normalizePhone(url.searchParams.get("phone")), parseSmsPurpose(url.searchParams.get("purpose")));
    if (!code) return new Response(null, { status: 404 });
    return Response.json({ code });
  } catch (error) {
    return jsonError(error);
  }
}
