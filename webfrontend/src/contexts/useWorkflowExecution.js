import { createContext, useContext } from "react";

export const WorkflowExecutionContext = createContext(null);

export function useWorkflowExecution() {
  const execution = useContext(WorkflowExecutionContext);
  if (!execution) throw new Error("WorkflowExecutionProvider ausente.");
  return execution;
}
