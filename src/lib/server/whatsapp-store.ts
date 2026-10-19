import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Group, Message } from "@/lib/types";

export interface StoredWhatsAppConversation {
  group: Group;
  messages: Message[];
}

interface CapturedMessage {
  header: string;
  text: string;
}

const localDirectory = path.join(process.cwd(), ".local");
const messagesPath = path.join(localDirectory, "whatsapp-messages.json");
const tokenPath = path.join(localDirectory, "whatsapp-ingest-token");
const messageHeaderPattern = /^\[([^\]]+)\]\s*(.+?):\s*$/;
const timestampPattern =
  /^(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?),\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseWhatsAppTimestamp(value: string) {
  const match = timestampPattern.exec(value);
  if (!match) {
    return undefined;
  }

  const [, time, firstPart, secondPart, yearPart] = match;
  const first = Number(firstPart);
  const second = Number(secondPart);
  const monthFirst =
    first > 12 ? false : second > 12 ? true : /(?:AM|PM)/i.test(time);
  const month = monthFirst ? first : second;
  const day = monthFirst ? second : first;
  const year = Number(yearPart) + (yearPart.length === 2 ? (Number(yearPart) < 70 ? 2000 : 1900) : 0);
  const timeWithoutMeridiem = time.replace(/\s?[AP]M$/i, "");
  const [rawHours, minutes, seconds = "0"] = timeWithoutMeridiem.split(":");
  let hours = Number(rawHours);
  if (/PM$/i.test(time) && hours < 12) {
    hours += 12;
  } else if (/AM$/i.test(time) && hours === 12) {
    hours = 0;
  }
  if (hours > 23 || Number(minutes) > 59 || Number(seconds) > 59) {
    return undefined;
  }

  const date = new Date(year, month - 1, day, hours, Number(minutes), Number(seconds));
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }

  return date.toISOString();
}

async function readConversationFile(): Promise<StoredWhatsAppConversation[]> {
  try {
    const contents = await readFile(messagesPath, "utf8");
    const value: unknown = JSON.parse(contents);
    if (
      !Array.isArray(value) ||
      !value.every(
        (conversation) =>
          isRecord(conversation) &&
          isRecord(conversation.group) &&
          Array.isArray(conversation.messages),
      )
    ) {
      throw new Error("O arquivo local de mensagens do WhatsApp tem um formato inválido.");
    }
    return value as StoredWhatsAppConversation[];
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeConversationFile(conversations: StoredWhatsAppConversation[]) {
  await mkdir(localDirectory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${messagesPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(conversations, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, messagesPath);
}

export async function listStoredWhatsAppConversations() {
  return readConversationFile();
}

export async function saveCapturedWhatsAppMessages(
  groupName: string,
  capturedMessages: CapturedMessage[],
) {
  const conversations = await readConversationFile();
  const groupId = `whatsapp-web-${createHash("sha256").update(groupName).digest("hex").slice(0, 16)}`;
  const current =
    conversations.find(({ group }) => group.id === groupId) ??
    ({
      group: {
        id: groupId,
        name: groupName,
        members: 0,
        status: "ativo",
        lastUpdated: new Date().toISOString(),
      },
      messages: [],
    } satisfies StoredWhatsAppConversation);
  const knownIds = new Set(current.messages.map((message) => message.id));
  const newMessages: Message[] = [];

  for (const captured of capturedMessages) {
    const header = messageHeaderPattern.exec(captured.header.trim());
    if (!header || typeof captured.text !== "string") {
      continue;
    }

    const [, rawTimestamp, rawSender] = header;
    const timestamp = parseWhatsAppTimestamp(rawTimestamp);
    const sender = rawSender.trim();
    const content = captured.text.trim();
    if (!timestamp || !sender || !content) {
      continue;
    }

    const id = createHash("sha256")
      .update(`${groupId}\n${rawTimestamp}\n${sender}\n${content}`)
      .digest("hex");
    if (knownIds.has(id)) {
      continue;
    }

    knownIds.add(id);
    newMessages.push({
      id,
      groupId,
      sender,
      content,
      timestamp,
      channel: "whatsapp",
      source: "WhatsApp Web",
    });
  }

  if (newMessages.length > 0) {
    current.messages.push(...newMessages);
    current.messages.sort((first, second) => first.timestamp.localeCompare(second.timestamp));
    current.group.members = new Set(current.messages.map(({ sender }) => sender)).size;
    current.group.lastUpdated =
      current.messages[current.messages.length - 1].timestamp;
    if (!conversations.some(({ group }) => group.id === groupId)) {
      conversations.push(current);
    }
    await writeConversationFile(conversations);
  }

  return { received: capturedMessages.length, added: newMessages.length, groupId };
}

export async function isWhatsAppIngestTokenValid(token: string | null) {
  if (!token) {
    return false;
  }

  let expectedToken: string;
  try {
    expectedToken = (await readFile(tokenPath, "utf8")).trim();
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }

  const provided = Buffer.from(token);
  const expected = Buffer.from(expectedToken);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
