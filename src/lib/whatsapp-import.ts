import type { Group, Message } from "@/lib/types";

export const importedConversationsStorageKey = "message-intelligence:whatsapp-imports";

export interface ImportedConversation {
  group: Group;
  messages: Message[];
}

const messageLinePattern =
  /^\u200e?\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\]?\s+(?:-\s+)?(.+?):\s(.*)$/i;
const timestampPrefixPattern =
  /^\u200e?\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}/;
const datePrefixPattern =
  /^\u200e?\[?(\d{1,2})\/(\d{1,2})\/\d{2,4},?\s+\d{1,2}:\d{2}/gm;

function parseTimestamp(
  firstDatePart: string,
  secondDatePart: string,
  year: string,
  time: string,
  defaultDateOrder: "day-first" | "month-first",
) {
  const first = Number(firstDatePart);
  const second = Number(secondDatePart);
  const dateOrder =
    first > 12 ? "day-first" : second > 12 ? "month-first" : defaultDateOrder;
  const day = dateOrder === "month-first" ? second : first;
  const month = dateOrder === "month-first" ? first : second;

  let fullYear = Number(year);
  if (year.length === 2) {
    fullYear += fullYear < 70 ? 2000 : 1900;
  }

  const [rawHours, minutes, seconds = "0"] = time.replace(/\s?[AP]M$/i, "").split(":");
  let hours = Number(rawHours);
  if (/PM$/i.test(time) && hours < 12) {
    hours += 12;
  } else if (/AM$/i.test(time) && hours === 12) {
    hours = 0;
  }

  const date = new Date(fullYear, month - 1, day, hours, Number(minutes), Number(seconds));
  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    hours > 23 ||
    Number(minutes) > 59 ||
    Number(seconds) > 59
  ) {
    return undefined;
  }

  return date.toISOString();
}

function isImportedConversation(value: unknown): value is ImportedConversation {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const conversation = value as Partial<ImportedConversation>;
  return (
    typeof conversation.group?.id === "string" &&
    typeof conversation.group.name === "string" &&
    typeof conversation.group.members === "number" &&
    typeof conversation.group.lastUpdated === "string" &&
    Array.isArray(conversation.messages) &&
    conversation.messages.every(
      (message) =>
        typeof message.id === "string" &&
        typeof message.groupId === "string" &&
        typeof message.sender === "string" &&
        typeof message.content === "string" &&
        typeof message.timestamp === "string" &&
        message.channel === "whatsapp" &&
        message.source === "WhatsApp",
    )
  );
}

export function readImportedConversations(value: string | null): ImportedConversation[] {
  if (value === null) {
    return [];
  }

  const decoded: unknown = JSON.parse(value);
  if (!Array.isArray(decoded) || !decoded.every(isImportedConversation)) {
    throw new Error("Os dados de conversas salvos neste navegador estão inválidos.");
  }

  return decoded;
}

export function parseWhatsAppExport(text: string, fileName: string): ImportedConversation {
  const groupId = `whatsapp-${crypto.randomUUID()}`;
  const messages: Message[] = [];
  let previousMessageIndex: number | undefined;
  let defaultDateOrder: "day-first" | "month-first" = "day-first";

  for (const match of text.matchAll(datePrefixPattern)) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12) {
      defaultDateOrder = "day-first";
    } else if (second > 12) {
      defaultDateOrder = "month-first";
    }
  }

  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const match = messageLinePattern.exec(line);

    if (!match) {
      if (timestampPrefixPattern.test(line)) {
        previousMessageIndex = undefined;
      } else if (previousMessageIndex !== undefined && line.trim()) {
        messages[previousMessageIndex].content += `\n${line}`;
      }
      continue;
    }

    const [, firstDatePart, secondDatePart, year, time, sender, content] = match;
    const timestamp = parseTimestamp(
      firstDatePart,
      secondDatePart,
      year,
      time,
      defaultDateOrder,
    );
    if (!timestamp) {
      throw new Error(`Não foi possível interpretar a data desta mensagem: ${line.slice(0, 100)}`);
    }

    messages.push({
      id: `${groupId}-message-${messages.length + 1}`,
      groupId,
      sender: sender.trim(),
      content,
      timestamp,
      channel: "whatsapp",
      source: "WhatsApp",
    });
    previousMessageIndex = messages.length - 1;
  }

  if (messages.length === 0) {
    throw new Error(
      "Nenhuma mensagem reconhecida. Selecione um arquivo .txt exportado pelo WhatsApp.",
    );
  }

  const senders = new Set(messages.map((message) => message.sender));
  const latestTimestamp = messages.reduce(
    (latest, message) => (message.timestamp > latest ? message.timestamp : latest),
    messages[0].timestamp,
  );
  const name = fileName.replace(/\.txt$/i, "").trim() || "Conversa do WhatsApp";

  return {
    group: {
      id: groupId,
      name,
      members: senders.size,
      status: "ativo",
      lastUpdated: latestTimestamp,
    },
    messages,
  };
}
