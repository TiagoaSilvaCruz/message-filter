import { isWhatsAppIngestTokenValid, saveCapturedWhatsAppMessages } from "@/lib/server/whatsapp-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxMessagesPerRequest = 3000;
const maxMessageLength = 20_000;
const maxRequestBytes = 8_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  if (!(await isWhatsAppIngestTokenValid(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null))) {
    return Response.json({ error: "Coletor não autorizado." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) {
    return Response.json({ error: "O lote de mensagens excede o limite permitido." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "O corpo da requisição precisa ser JSON válido." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    typeof body.groupName !== "string" ||
    body.groupName.trim().length === 0 ||
    body.groupName.length > 200 ||
    !Array.isArray(body.messages) ||
    body.messages.length > maxMessagesPerRequest ||
    !body.messages.every(
      (message) =>
        isRecord(message) &&
        typeof message.header === "string" &&
        message.header.length <= 500 &&
        typeof message.text === "string" &&
        message.text.length <= maxMessageLength,
    )
  ) {
    return Response.json({ error: "O grupo ou as mensagens têm formato inválido." }, { status: 400 });
  }

  const result = await saveCapturedWhatsAppMessages(
    body.groupName.trim(),
    body.messages as Array<{ header: string; text: string }>,
  );
  return Response.json(result);
}
