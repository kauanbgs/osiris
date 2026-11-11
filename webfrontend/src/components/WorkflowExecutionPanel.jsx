import { useState } from "react";
import { useWorkflowExecution } from "@/contexts/useWorkflowExecution";

const EVENT_STYLES = {
  error: "text-red-400",
  cancelled: "text-red-400",
  done: "text-emerald-400",
  complete: "text-emerald-400",
  rateLimit: "text-amber-400",
};

// Painel flutuante do workflow: executar/parar e o log de eventos da
// execucao, no mesmo formato do painel "Execucao" do mobile.
export default function WorkflowExecutionPanel() {
  const execution = useWorkflowExecution();
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute left-4 top-4 z-50 flex max-w-md flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-200">
      <div className="flex gap-2">
        <button type="button" disabled={execution.running} onClick={() => execution.run()} className="rounded bg-violet-600 px-3 py-2 disabled:opacity-40">Executar workflow</button>
        {execution.running && <button type="button" onClick={execution.stop} className="rounded bg-red-950 px-3 py-2 text-red-300">Parar</button>}
        {execution.events.length > 0 && (
          <button type="button" onClick={() => setOpen((current) => !current)} className="rounded bg-zinc-900 px-3 py-2 hover:bg-zinc-800">
            Execucao{open ? "" : ` (${execution.events.length})`}
          </button>
        )}
      </div>
      {open && (
        <div className="max-h-72 overflow-y-auto border-t border-zinc-800 pt-2">
          {execution.events.length === 0
            ? <p className="text-zinc-500">Nenhuma execucao nesta sessao.</p>
            : [...execution.events].reverse().map((event) => (
                <div key={event.id} className="flex gap-2 border-b border-zinc-800/60 py-1">
                  <span className="shrink-0 pt-px text-zinc-500">{new Date(event.time).toLocaleTimeString()}</span>
                  <div className="min-w-0">
                    <p className={EVENT_STYLES[event.type] || "text-zinc-400"}>{event.title}</p>
                    {event.text && <pre className="whitespace-pre-wrap break-words text-zinc-500">{event.text}</pre>}
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}
