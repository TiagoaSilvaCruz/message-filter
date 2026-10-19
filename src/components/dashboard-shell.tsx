'use client';

import { useEffect, useRef, useState } from "react";
import type { Category, Group, GroupDashboard, Priority } from "@/lib/types";
import { MessageItem } from "@/components/message-item";
import { analyzeMessage, buildConversationInsight } from "@/lib/intelligence";
import {
  importedConversationsStorageKey,
  parseWhatsAppExport,
  readImportedConversations,
  type ImportedConversation,
} from "@/lib/whatsapp-import";

export function DashboardShell() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [importedConversations, setImportedConversations] = useState<ImportedConversation[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string>();
  const [dashboard, setDashboard] = useState<GroupDashboard>();
  const [error, setError] = useState<string>();
  const [importError, setImportError] = useState<string>();
  const [importNotice, setImportNotice] = useState<string>();
  const [categoryFilter, setCategoryFilter] = useState<Category | "todas">("todas");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "todas">("todas");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadGroups() {
      try {
        let savedConversations: ImportedConversation[] = [];
        try {
          savedConversations = readImportedConversations(
            window.localStorage.getItem(importedConversationsStorageKey),
          );
        } catch (loadError) {
          setImportError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível ler as conversas salvas neste navegador.",
          );
        }
        setImportedConversations(savedConversations);

        const response = await fetch("/api/groups", { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Não foi possível carregar os grupos.");
        }

        const data: { groups: Group[] } = await response.json();
        const allGroups = [...savedConversations.map(({ group }) => group), ...data.groups];
        setGroups(allGroups);
        setActiveGroupId(allGroups[0]?.id);
        setGroupsLoaded(true);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Erro ao carregar grupos.");
          setGroupsLoaded(true);
        }
      }
    }

    void loadGroups();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (
      typeof activeGroupId !== "string" ||
      importedConversations.some(({ group }) => group.id === activeGroupId)
    ) {
      return;
    }
    const groupId: string = activeGroupId;

    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Não foi possível carregar a análise do grupo.");
        }

        const data: GroupDashboard = await response.json();
        setDashboard(data);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Erro ao carregar análise.");
        }
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [activeGroupId, importedConversations]);

  async function importConversation(file?: File) {
    if (!file) {
      return;
    }

    setImportError(undefined);
    setImportNotice(undefined);

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setImportError("O WhatsApp deve ser exportado como arquivo .txt.");
      return;
    }

    try {
      const conversation = parseWhatsAppExport(await file.text(), file.name);
      const nextConversations = [conversation, ...importedConversations];
      window.localStorage.setItem(
        importedConversationsStorageKey,
        JSON.stringify(nextConversations),
      );
      setImportedConversations(nextConversations);
      setGroups((currentGroups) => [conversation.group, ...currentGroups]);
      setActiveGroupId(conversation.group.id);
      setError(undefined);
      setImportNotice(
        `${conversation.messages.length} mensagens importadas. Elas ficam salvas somente neste navegador.`,
      );
    } catch (importFailure) {
      setImportError(
        importFailure instanceof Error
          ? importFailure.message
          : "Não foi possível importar esta conversa.",
      );
    }
  }

  const activeGroup = groups.find((item) => item.id === activeGroupId) ?? dashboard?.group;
  const importedConversation = importedConversations.find(
    ({ group }) => group.id === activeGroupId,
  );
  const activeDashboard = importedConversation
    ? {
        group: importedConversation.group,
        messages: importedConversation.messages,
        analyses: importedConversation.messages.map(analyzeMessage),
        insights: buildConversationInsight(importedConversation.messages),
        provider: "heuristic" as const,
      }
    : dashboard?.group.id === activeGroupId
      ? dashboard
      : undefined;
  const loading = !groupsLoaded || Boolean(activeGroupId && !activeDashboard && !error);
  const activeMessages = activeDashboard?.messages ?? [];
  const analyses = activeDashboard?.analyses ?? [];
  const filteredItems = activeMessages
    .map((message, index) => ({ message, analysis: analyses[index] }))
    .filter(({ message, analysis }) => {
      if (!analysis) {
        return false;
      }
      const messageDate = new Date(message.timestamp);
      const localDate = [
        messageDate.getFullYear(),
        String(messageDate.getMonth() + 1).padStart(2, "0"),
        String(messageDate.getDate()).padStart(2, "0"),
      ].join("-");

      return (
        (categoryFilter === "todas" || analysis.category === categoryFilter) &&
        (priorityFilter === "todas" || analysis.priority === priorityFilter) &&
        (!startDateFilter || localDate >= startDateFilter) &&
        (!endDateFilter || localDate <= endDateFilter)
      );
    });
  const filteredMessages = filteredItems.map(({ message }) => message);
  const hasFilters =
    categoryFilter !== "todas" ||
    priorityFilter !== "todas" ||
    Boolean(startDateFilter || endDateFilter);
  const insights = hasFilters
    ? buildConversationInsight(filteredMessages)
    : activeDashboard?.insights;
  const nextAction = filteredItems.filter(({ analysis }) => analysis.actionRequired).length;
  const highPriority = filteredItems.filter(({ analysis }) => analysis.priority === "alta").length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-7xl gap-6 p-6">
        <aside className="w-80 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
              Message Intelligence
            </p>
            <h1 className="mt-2 text-2xl font-bold">Dashboard</h1>
          </div>

          <div className="mb-6 rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <h2 className="font-semibold text-slate-800">Importar conversa</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Escolha um arquivo .txt exportado pelo WhatsApp. A leitura e a análise simulada
              acontecem neste navegador.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="sr-only"
              onChange={(event) => {
                void importConversation(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 w-full rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              Selecionar arquivo .txt
            </button>
            {importError && (
              <p role="alert" className="mt-3 text-xs leading-5 text-red-700">
                {importError}
              </p>
            )}
            {importNotice && (
              <p role="status" className="mt-3 text-xs leading-5 text-emerald-700">
                {importNotice}
              </p>
            )}
          </div>

          <nav className="space-y-3">
            {groups.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setError(undefined);
                  setActiveGroupId(item.id);
                }}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  item.id === activeGroupId
                    ? "border-violet-200 bg-violet-50"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.members} membros</p>
                  </div>
                  <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] uppercase text-slate-700">
                    {item.status}
                  </span>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 space-y-6">
          <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-violet-600">Grupo ativo</p>
                <h2 className="mt-1 text-3xl font-bold">{activeGroup?.name ?? "Carregando grupos..."}</h2>
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                  {activeGroup?.status ?? "carregando"}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Mensagens</p>
                <p className="mt-2 text-3xl font-bold">{loading ? "..." : activeMessages.length}</p>
              </div>
              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-xs uppercase tracking-wide text-red-500">Alta prioridade</p>
                <p className="mt-2 text-3xl font-bold text-red-700">{highPriority}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-xs uppercase tracking-wide text-amber-500">Ações</p>
                <p className="mt-2 text-3xl font-bold text-amber-700">{nextAction}</p>
              </div>
              <div className="rounded-2xl bg-violet-50 p-4">
                <p className="text-xs uppercase tracking-wide text-violet-500">Resumo</p>
                <p className="mt-2 text-sm font-semibold text-violet-700">
                  {loading
                    ? "Analisando..."
                    : activeDashboard?.provider === "ollama"
                      ? "Ollama local"
                      : importedConversation
                        ? "Simulação local"
                        : "Regras locais"}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-800">Filtrar mensagens</h3>
                <span className="text-xs text-slate-500" aria-live="polite">
                  {filteredItems.length} de {activeMessages.length} mensagens
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <label className="text-xs font-medium text-slate-600">
                  Tag
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value as Category | "todas")}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="todas">Todas as tags</option>
                    <option value="prazo">Prazo</option>
                    <option value="pergunta">Pergunta</option>
                    <option value="aviso">Aviso</option>
                    <option value="evento">Evento</option>
                    <option value="urgente">Urgente</option>
                    <option value="rotina">Rotina</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Prioridade
                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value as Priority | "todas")}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="todas">Todas as prioridades</option>
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Data da mensagem — de
                  <input
                    type="date"
                    value={startDateFilter}
                    max={endDateFilter || undefined}
                    onChange={(event) => setStartDateFilter(event.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Data da mensagem — até
                  <input
                    type="date"
                    value={endDateFilter}
                    min={startDateFilter || undefined}
                    onChange={(event) => setEndDateFilter(event.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("todas");
                    setPriorityFilter("todas");
                    setStartDateFilter("");
                    setEndDateFilter("");
                  }}
                  disabled={!hasFilters}
                  className="self-end rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          </header>

          <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
            <section className="space-y-4">
              {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
              {!error && loading && <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Carregando mensagens e análise...</p>}
              {!error && !loading && activeMessages.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Nenhuma mensagem neste grupo.</p>}
              {!error && !loading && activeMessages.length > 0 && filteredItems.length === 0 && (
                <p className="rounded-xl bg-white p-4 text-sm text-slate-600">
                  Nenhuma mensagem corresponde aos filtros selecionados.
                </p>
              )}
              {filteredItems.map(({ message, analysis }) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  analysis={analysis}
                />
              ))}
            </section>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
                  Insight geral
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-700">{insights?.summary ?? "Aguardando análise do grupo."}</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold">Importante</h3>
                <ul className="mt-3 space-y-3 text-sm text-slate-700">
                  {(insights?.important ?? []).map((item) => (
                    <li key={item} className="rounded-xl bg-slate-50 p-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold">Ações necessárias</h3>
                <ul className="mt-3 space-y-3 text-sm text-slate-700">
                  {(insights?.actions ?? []).map((item) => (
                    <li key={item} className="rounded-xl bg-red-50 p-3 text-red-700">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
