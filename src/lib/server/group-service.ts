import { analyzeMessage, buildConversationInsight } from "@/lib/intelligence";
import type { GroupDashboard } from "@/lib/types";
import { analyzeWithOllama } from "@/lib/server/ollama-client";
import { findGroup, listGroupMessages } from "@/lib/server/group-repository";

export async function getGroupDashboard(groupId: string): Promise<GroupDashboard | undefined> {
  const group = await findGroup(groupId);
  if (!group) {
    return undefined;
  }

  const messages = await listGroupMessages(groupId);
  if (process.env.AI_PROVIDER === "ollama") {
    try {
      const result = await analyzeWithOllama(messages);
      const analysesById = new Map(result.analyses.map(({ id, analysis }) => [id, analysis]));

      return {
        group,
        messages,
        analyses: messages.map((message) => analysesById.get(message.id)!),
        insights: result.insights,
        provider: "ollama",
      };
    } catch (error) {
      console.warn("Análise local indisponível; usando regras de fallback.", error);
    }
  }

  return {
    group,
    messages,
    analyses: messages.map(analyzeMessage),
    insights: buildConversationInsight(messages),
    provider: "heuristic",
  };
}