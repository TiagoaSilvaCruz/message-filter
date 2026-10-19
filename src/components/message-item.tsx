import type { Message, MessageAnalysis } from "@/lib/types";

interface MessageItemProps {
  message: Message;
  analysis: MessageAnalysis;
}

function priorityStyles(priority: MessageAnalysis["priority"]) {
  if (priority === "alta") {
    return "bg-red-100 text-red-700 ring-red-200";
  }

  if (priority === "media") {
    return "bg-amber-100 text-amber-700 ring-amber-200";
  }

  return "bg-emerald-100 text-emerald-700 ring-emerald-200";
}

export function MessageItem({ message, analysis }: MessageItemProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{message.sender}</p>
          <p className="text-xs text-slate-500">{message.source}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
            {analysis.category}
          </span>
          <span className={`rounded-full px-2 py-1 text-[10px] font-medium ring-1 ${priorityStyles(analysis.priority)}`}>
            {analysis.priority}
          </span>
        </div>
      </div>

      <p className="text-sm leading-6 text-slate-700">{message.content}</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>{new Date(message.timestamp).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
        <span>Confiança: {(analysis.confidence * 100).toFixed(0)}%</span>
      </div>
    </article>
  );
}
