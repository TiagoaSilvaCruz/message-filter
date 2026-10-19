import type { ConversationInsight, Message, MessageAnalysis } from "@/lib/types";

export function detectDate(content: string) {
  const formats = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g,
    /(\d{1,2} de [a-zç]+(?: de \d{4})?)/gi,
  ];

  for (const regex of formats) {
    const match = content.match(regex);
    if (match) {
      return match[0];
    }
  }

  return undefined;
}

export function classifyCategory(content: string) {
  const lowercase = content.toLowerCase();

  if (/prazo|entrega|venc|deadline|até \d|data limite|fecha|entregar/i.test(lowercase)) {
    return "prazo";
  }

  if (/urgente|imediato|crítico|crítica|prioridade|hoje|agora/i.test(lowercase)) {
    return "urgente";
  }

  if (/evento|reunião|lançamento|alinhamento|briefing|agenda/i.test(lowercase)) {
    return "evento";
  }

  if (/pergunta|pode|poderia|qual|quando|como|status|confirmar/i.test(lowercase)) {
    return "pergunta";
  }

  if (/aviso|atenção|importante|não esquecer|atualização|mudança/i.test(lowercase)) {
    return "aviso";
  }

  return "rotina";
}

export function classifyPriority(content: string) {
  const lowercase = content.toLowerCase();

  if (
    /urgente|imediato|crítico|crítica|hoje|agora|sla|prioridade|entrega.*hoje/i.test(
      lowercase,
    )
  ) {
    return "alta";
  }

  if (/prazo|entrega|evento|reunião|confirmar|aprovar|envio/i.test(lowercase)) {
    return "media";
  }

  return "baixa";
}

export function analyzeMessage(message: Message): MessageAnalysis {
  const category = classifyCategory(message.content);
  const priority = classifyPriority(message.content);
  const date = detectDate(message.content);
  const question = /\?|pode|poderia|qual|quando|como|status|confirmar/i.test(
    message.content,
  );

  const actionRequired = /urgente|preciso|necessário|confirmar|aprovar|revisar|responder|envio|prazo/i.test(
    message.content,
  );

  let reason = "Mensagem com informação operacional relevante para o grupo.";

  if (category === "prazo") {
    reason = "A mensagem informa um prazo, entrega ou data limite que exige atenção.";
  }

  if (category === "pergunta") {
    reason = "A mensagem solicita confirmação, resposta ou clarificação de outra pessoa.";
  }

  if (category === "urgente") {
    reason = "A mensagem sinaliza urgência ou risco de impacto imediato.";
  }

  if (category === "evento") {
    reason = "A mensagem menciona um evento, reunião ou cronograma relevante.";
  }

  const confidence = Math.min(0.97, 0.72 + (category !== "rotina" ? 0.12 : 0.04) + (date ? 0.08 : 0))
    .toFixed(2)
    .replace("0.", "");

  const numericConfidence = Number(`0.${confidence}`);

  const summary = `${message.sender} reportou: "${message.content.slice(0, 90)}${message.content.length > 90 ? "..." : ""}"`;

  return {
    category,
    priority,
    confidence: Number(numericConfidence.toFixed(2)),
    actionRequired,
    date,
    reason,
    question,
    summary,
  };
}

export function buildConversationInsight(messages: Message[]): ConversationInsight {
  const analyses = messages.map(analyzeMessage);
  const important = analyses
    .filter((analysis) => analysis.priority === "alta" || analysis.actionRequired)
    .map((analysis, index) => `${index + 1}. ${analysis.summary}`)
    .slice(0, 4);

  const actions = analyses
    .filter((analysis) => analysis.actionRequired)
    .map((analysis) => `${analysis.category.toUpperCase()} — ${analysis.reason}`)
    .slice(0, 4);

  const deadlines = analyses
    .filter((analysis) => analysis.date)
    .map((analysis) => `${analysis.date} — ${analysis.category}`)
    .slice(0, 4);

  const alerts = analyses
    .filter((analysis) => analysis.priority === "alta" || analysis.category === "urgente")
    .map((analysis) => `${analysis.category} com prioridade ${analysis.priority}`)
    .slice(0, 4);

  const questions = analyses
    .filter((analysis) => analysis.question)
    .map((analysis) => `${analysis.summary}`)
    .slice(0, 3);

  return {
    summary:
      "A conversa concentra atenção em prazos, confirmações e ações urgentes, com destaque para pendências de entrega e revisão de materiais.",
    important,
    actions,
    deadlines,
    alerts,
    questions,
  };
}
