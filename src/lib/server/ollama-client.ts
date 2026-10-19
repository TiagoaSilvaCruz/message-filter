import type {
  Category,
  ConversationInsight,
  Message,
  MessageAnalysis,
  Priority,
} from "@/lib/types";

const categories: Category[] = [
  "prazo",
  "pergunta",
  "aviso",
  "evento",
  "urgente",
  "rotina",
];
const priorities: Priority[] = ["baixa", "media", "alta"];

export interface AiAnalysis {
  analyses: Array<{ id: string; analysis: MessageAnalysis }>;
  insights: ConversationInsight;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseAnalysis(value: unknown): AiAnalysis | undefined {
  if (!isRecord(value) || !Array.isArray(value.analyses) || !isRecord(value.insights)) {
    return undefined;
  }

  const analyses: AiAnalysis["analyses"] = [];

  for (const item of value.analyses) {
    if (!isRecord(item) || typeof item.id !== "string" || !isRecord(item.analysis)) {
      return undefined;
    }

    const analysis = item.analysis;
    if (
      !categories.includes(analysis.category as Category) ||
      !priorities.includes(analysis.priority as Priority) ||
      typeof analysis.confidence !== "number" ||
      analysis.confidence < 0 ||
      analysis.confidence > 1 ||
      typeof analysis.actionRequired !== "boolean" ||
      typeof analysis.reason !== "string" ||
      typeof analysis.question !== "boolean" ||
      typeof analysis.summary !== "string" ||
      (analysis.date !== undefined && analysis.date !== null && typeof analysis.date !== "string")
    ) {
      return undefined;
    }

    analyses.push({
      id: item.id,
      analysis: {
        category: analysis.category as Category,
        priority: analysis.priority as Priority,
        confidence: analysis.confidence,
        actionRequired: analysis.actionRequired,
        date: typeof analysis.date === "string" ? analysis.date : undefined,
        reason: analysis.reason,
        question: analysis.question,
        summary: analysis.summary,
      },
    });
  }

  const insights = value.insights;
  if (
    typeof insights.summary !== "string" ||
    !stringList(insights.important) ||
    !stringList(insights.actions) ||
    !stringList(insights.deadlines) ||
    !stringList(insights.alerts) ||
    !stringList(insights.questions)
  ) {
    return undefined;
  }

  return {
    analyses,
    insights: {
      summary: insights.summary,
      important: insights.important.slice(0, 4),
      actions: insights.actions.slice(0, 4),
      deadlines: insights.deadlines.slice(0, 4),
      alerts: insights.alerts.slice(0, 4),
      questions: insights.questions.slice(0, 3),
    },
  };
}

export async function analyzeWithOllama(messages: Message[]): Promise<AiAnalysis> {
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL ?? "qwen3:8b";
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      think: false,
      options: { temperature: 0.1, num_ctx: 4096, num_predict: 1200 },
      messages: [
        {
          role: "system",
          content:
            "Analise mensagens de trabalho em português. Responda somente JSON válido, sem markdown. " +
            "Não invente fatos ou datas. urgency não deve ser inferida apenas pelo tom. " +
            "Use category: prazo, pergunta, aviso, evento, urgente ou rotina; priority: baixa, media ou alta. " +
            "confidence deve ser número entre 0 e 1. Retorne {analyses:[{id,analysis:{category,priority,confidence,actionRequired,date,reason,question,summary}}],insights:{summary,important,actions,deadlines,alerts,questions}}. " +
            "Mantenha todos os ids recebidos exatamente uma vez. date deve ser string ou null; listas de insights devem conter strings.",
        },
        {
          role: "user",
          content: JSON.stringify(messages.map(({ id, sender, content, timestamp }) => ({
            id,
            sender,
            content,
            timestamp,
          }))),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama respondeu com HTTP ${response.status}`);
  }

  const body: unknown = await response.json();
  if (!isRecord(body) || !isRecord(body.message) || typeof body.message.content !== "string") {
    throw new Error("Resposta inválida do Ollama");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(body.message.content);
  } catch {
    throw new Error("O Ollama não retornou JSON válido");
  }

  const result = parseAnalysis(decoded);
  const expectedIds = new Set(messages.map((message) => message.id));
  if (
    !result ||
    result.analyses.length !== messages.length ||
    new Set(result.analyses.map((item) => item.id)).size !== expectedIds.size ||
    result.analyses.some((item) => !expectedIds.has(item.id))
  ) {
    throw new Error("A resposta do Ollama não corresponde às mensagens enviadas");
  }

  return result;
}