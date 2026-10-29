import { useWorkflowExecution } from "@/contexts/useWorkflowExecution";
export default function WorkflowExecutionPanel() {
  const execution = useWorkflowExecution();
  return <div className="absolute left-4 top-4 z-50 flex gap-2 rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-200">
    <button type="button" disabled={execution.running} onClick={() => execution.run()} className="rounded bg-violet-600 px-3 py-2 disabled:opacity-40">Executar workflow</button>
    {execution.running && <button type="button" onClick={execution.stop} className="rounded bg-red-950 px-3 py-2 text-red-300">Parar</button>}
  </div>;
}
