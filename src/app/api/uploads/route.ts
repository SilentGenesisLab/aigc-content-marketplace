export const runtime = "nodejs";

import OSS from "ali-oss";
import { ApiError, requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("请选择文件");
    if (file.size > 100 * 1024 * 1024) throw new ApiError("单个文件不能超过 100MB");
    if (process.env.APP_ENV === "test" && process.env.FILE_PROVIDER === "memory") {
      return Response.json({ url: `https://e2e.invalid/${encodeURIComponent(file.name)}`, name: file.name, size: String(file.size), contentType: file.type });
    }
    const region = process.env.OSS_REGION;
    const bucket = process.env.OSS_BUCKET;
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    if (!region || !bucket || !accessKeyId || !accessKeySecret) throw new ApiError("文件存储尚未配置", 503);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const objectName = `deliveries/${user.id}/${Date.now()}-${safeName}`;
    const client = new OSS({ region, bucket, accessKeyId, accessKeySecret, secure: true });
    const result = await client.put(objectName, Buffer.from(await file.arrayBuffer()), { headers: { "Content-Type": file.type || "application/octet-stream" } });
    return Response.json({ url: result.url, name: file.name, size: String(file.size), contentType: file.type });
  } catch (error) { return jsonError(error); }
}
