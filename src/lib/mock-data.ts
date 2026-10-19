import type { Group, Message } from "@/lib/types";

export const mockGroups: Group[] = [
  {
    id: "grupo-1",
    name: "Equipe de Operações",
    members: 14,
    status: "ativo",
    lastUpdated: "2026-09-19T15:35:00.000Z",
  },
  {
    id: "grupo-2",
    name: "Marketing e Conteúdo",
    members: 9,
    status: "em-análise",
    lastUpdated: "2026-09-19T13:10:00.000Z",
  },
  {
    id: "grupo-3",
    name: "Atendimento ao Cliente",
    members: 7,
    status: "pendente",
    lastUpdated: "2026-09-19T10:04:00.000Z",
  },
];

export const mockMessages: Message[] = [
  {
    id: "msg-1",
    groupId: "grupo-1",
    sender: "Ana",
    content:
      "A entrega do cliente XP-39 precisa ser enviada até 25/09. Preciso de confirmação do envio hoje.",
    timestamp: "2026-09-19T08:15:00.000Z",
    channel: "whatsapp",
    source: "WhatsApp",
  },
  {
    id: "msg-2",
    groupId: "grupo-1",
    sender: "Bruno",
    content:
      "Já confirmei com logística. A coleta foi agendada para 22/09 às 14h e a nota fiscal está pronta.",
    timestamp: "2026-09-19T08:45:00.000Z",
    channel: "whatsapp",
    source: "WhatsApp",
  },
  {
    id: "msg-3",
    groupId: "grupo-1",
    sender: "Carlos",
    content:
      "Alguém pode revisar a proposta do cliente antes do fechamento de hoje? É urgente.",
    timestamp: "2026-09-19T09:02:00.000Z",
    channel: "chat",
    source: "Chat interno",
  },
  {
    id: "msg-4",
    groupId: "grupo-1",
    sender: "Daniela",
    content:
      "O evento de lançamento está marcado para 30/09. Precisa de briefing atualizado até sexta.",
    timestamp: "2026-09-19T10:12:00.000Z",
    channel: "email",
    source: "E-mail",
  },
  {
    id: "msg-5",
    groupId: "grupo-1",
    sender: "Eduardo",
    content:
      "Reunião de alinhamento foi adiada para 24/09 às 11h. Nenhuma ação urgente neste momento.",
    timestamp: "2026-09-19T11:00:00.000Z",
    channel: "sms",
    source: "SMS",
  },
  {
    id: "msg-6",
    groupId: "grupo-2",
    sender: "Fernanda",
    content:
      "A campanha do mês entrou em revisão. As artes precisam ser aprovadas até 24/09.",
    timestamp: "2026-09-19T12:05:00.000Z",
    channel: "whatsapp",
    source: "WhatsApp",
  },
  {
    id: "msg-7",
    groupId: "grupo-2",
    sender: "Giovanni",
    content:
      "Qual é o texto final da oferta de aniversário? Preciso enviar para o cliente hoje.",
    timestamp: "2026-09-19T12:25:00.000Z",
    channel: "chat",
    source: "Chat interno",
  },
  {
    id: "msg-8",
    groupId: "grupo-3",
    sender: "Helena",
    content:
      "Cliente informou que recebeu a entrega atrasada. Solicita devolução e envio novo.",
    timestamp: "2026-09-19T07:40:00.000Z",
    channel: "email",
    source: "E-mail",
  },
  {
    id: "msg-9",
    groupId: "grupo-3",
    sender: "Igor",
    content:
      "Atenção: ticket de suporte abriu sla crítico para 21/09. Requer resposta imediata.",
    timestamp: "2026-09-19T08:10:00.000Z",
    channel: "whatsapp",
    source: "WhatsApp",
  },
  {
    id: "msg-10",
    groupId: "grupo-3",
    sender: "Julia",
    content:
      "O cliente quer saber sobre o status do pagamento. Pode me ajudar a confirmar?",
    timestamp: "2026-09-19T09:28:00.000Z",
    channel: "chat",
    source: "Chat interno",
  },
];

export function getGroupMessages(groupId: string) {
  return mockMessages.filter((message) => message.groupId === groupId);
}

export function getDefaultGroup() {
  return mockGroups[0];
}
