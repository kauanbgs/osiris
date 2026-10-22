// Workflow files contain model identifiers only; credentials stay in model settings.
export function resolveWorkflowModel(data = {}, activeModel) {
  if (data.modelConfig) {
    const config = data.modelConfig;
    if (config.type === "cloud" && config.provider && config.model) {
      return { type: "cloud", provider: config.provider, model: config.model, name: config.name };
    }
    if (config.type === "local" && config.modelPath) {
      return { type: "local", modelPath: config.modelPath, name: config.name };
    }
    throw new Error("Selecione um modelo valido para este agente.");
  }
  if (data.model) throw new Error("O modelo antigo deste agente precisa ser selecionado novamente.");
  return activeModel;
}

export function workflowModelKey(config) {
  if (!config) return "";
  return config.type === "cloud"
    ? JSON.stringify(["cloud", config.provider, config.model])
    : JSON.stringify(["local", config.modelPath]);
}
