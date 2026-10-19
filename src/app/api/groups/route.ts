import { listGroups } from "@/lib/server/group-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ groups: await listGroups() });
}