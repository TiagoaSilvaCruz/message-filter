import { getGroupDashboard } from "@/lib/server/group-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const dashboard = await getGroupDashboard(groupId);

  if (!dashboard) {
    return Response.json({ error: "Grupo não encontrado." }, { status: 404 });
  }

  return Response.json(dashboard);
}