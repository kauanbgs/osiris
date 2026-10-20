import { useWorkflowExecution } from "@/contexts/useWorkflowExecution";
const labels = { waiting: "Aguardando", running: "Executando", done: "Concluido", error: "Erro", cancelled: "Interrompido", skipped: "Nao executado" };
export default function WorkflowExecutionPanel() {
  const execution = useWorkflowExecution();
  return <>
    <div className="absolute left-4 top-4 z-50 flex gap-2 rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-200">
      <button type="button" disabled={execution.running} onClick={() => execution.run()} className="rounded bg-violet-600 px-3 py-2 disabled:opacity-40">Executar workflow</button>
      {execution.running && <button type="button" onClick={execution.stop} className="rounded bg-red-950 px-3 py-2 text-red-300">Parar</button>}
      <button type="button" onClick={() => execution.setPanelOpen(!execution.panelOpen)} className="px-2">{execution.panelOpen ? "Ocultar atividade" : "Ver atividade"}</button>
    </div>
    {execution.panelOpen && <aside aria-label="Atividade dos agentes" className="absolute bottom-16 right-4 top-20 z-40 flex w-[min(420px,45%)] flex-col rounded-xl border border-zinc-700 bg-zinc-950/95 text-zinc-200 shadow-xl">
      <div className="border-b border-zinc-800 p-3 text-sm font-medium">Atividade dos agentes {execution.running ? "- ao vivo" : ""}</div>
      <p className="px-3 pt-3 text-xs text-zinc-400">Conecte a saida de um agente a entrada do proximo. A resposta e as instrucoes serao entregues pela conexao.</p>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 select-text">
        {Object.entries(execution.agents).map(([id, agent]) => <section key={id} className="rounded border border-zinc-800 p-2 text-xs">
          <div className="flex justify-between gap-2"><strong>{agent.label}</strong><span className={agent.status === "running" ? "text-amber-300" : "text-zinc-400"}>{labels[agent.status]}</span></div>
          {agent.notice && <p role="status" className="mt-2 text-amber-300">{agent.notice}</p>}
          {agent.output && <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words font-sans">{agent.output}</pre>}
          {agent.error && <p role="alert" className="mt-2 text-red-400">{agent.error}</p>}
        </section>)}
        {execution.events.length === 0 && <p className="text-xs text-zinc-500">Execute o workflow para acompanhar tarefas e mensagens.</p>}
        {execution.events.map((event) => <article key={event.id} className={"rounded border p-2 text-xs " + (event.type === "transfer" ? "border-amber-700/60 bg-amber-950/20" : "border-zinc-800")}>
          <div className="flex gap-2"><time className="shrink-0 text-zinc-500">{new Date(event.time).toLocaleTimeString()}</time><strong className={event.type === "error" ? "text-red-400" : event.type === "transfer" ? "text-amber-300" : "text-zinc-300"}>{event.title}</strong></div>
          {event.note && <p className="mt-1 text-amber-400">{event.note}</p>}
          {event.text && <details open={event.type === "transfer"}><summary className="mt-2 cursor-pointer text-violet-300">{event.type === "transfer" ? "Instrucoes enviadas" : "Ver detalhes"}</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words font-sans text-zinc-300">{event.text}</pre></details>}
        </article>)}
      </div>
    </aside>}
  </>;
}
