export type Category =
  | "prazo"
  | "pergunta"
  | "aviso"
  | "evento"
  | "urgente"
  | "rotina";

export type Priority = "baixa" | "media" | "alta";

export type SourceChannel = "whatsapp" | "email" | "sms" | "chat";

export interface Message {
  id: string;
  groupId: string;
  sender: string;
  content: string;
  timestamp: string;
  channel: SourceChannel;
  source: string;
}

export interface MessageAnalysis {
  category: Category;
  priority: Priority;
  confidence: number;
  actionRequired: boolean;
  date?: string;
  reason: string;
  question: boolean;
  summary: string;
}

export interface Group {
  id: string;
  name: string;
  members: number;
  status: "ativo" | "em-análise" | "pendente";
  lastUpdated: string;
}

export interface InsightSection {
  title: string;
  items: string[];
}

export interface ConversationInsight {
  summary: string;
  important: string[];
  actions: string[];
  deadlines: string[];
  alerts: string[];
  questions: string[];
}

export interface GroupDashboard {
  group: Group;
  messages: Message[];
  analyses: MessageAnalysis[];
  insights: ConversationInsight;
  provider: "ollama" | "heuristic";
}
