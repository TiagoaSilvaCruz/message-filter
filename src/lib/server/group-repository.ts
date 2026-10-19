import { getGroupMessages, mockGroups } from "@/lib/mock-data";
import { listStoredWhatsAppConversations } from "@/lib/server/whatsapp-store";

export async function listGroups() {
  const conversations = await listStoredWhatsAppConversations();
  return [...conversations.map(({ group }) => group), ...mockGroups];
}

export async function findGroup(groupId: string) {
  const importedGroup = (await listStoredWhatsAppConversations()).find(
    ({ group }) => group.id === groupId,
  )?.group;
  return importedGroup ?? mockGroups.find((group) => group.id === groupId);
}

export async function listGroupMessages(groupId: string) {
  const importedConversation = (await listStoredWhatsAppConversations()).find(
    ({ group }) => group.id === groupId,
  );
  return importedConversation?.messages ?? getGroupMessages(groupId);
}