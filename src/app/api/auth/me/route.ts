import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
export async function GET() { try { return Response.json({ user: await requireUser() }); } catch (error) { return jsonError(error); } }

