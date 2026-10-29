import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CLOUD_PROVIDERS, CUSTOM_PROVIDER_ID, getActiveModel, getAllProviderModels, getCustomServer, getStoredCloudKeys } from "@/services/llmService";
import { workflowModelKey } from "@/workflow/modelSelection";

export default function WorkflowModelSelect({ data, disabled, onChange }) {
  const [localModels, setLocalModels] = useState([]);
  const [activeModel, setActiveModel] = useState(getActiveModel);
  const [keys, setKeys] = useState(getStoredCloudKeys);
  const [customServer, setCustomServer] = useState(getCustomServer);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    async function refresh() {
      setActiveModel(getActiveModel());
      setKeys(getStoredCloudKeys());
      setCustomServer(getCustomServer());
      if (!window.llama?.listLocalModels) return;
      try {
        const models = await window.llama.listLocalModels();
        if (alive) { setLocalModels(models); setError(""); }
      } catch {
        if (alive) setError("Erro ao listar modelos locais.");
      }
    }
    refresh();
    window.addEventListener("osiris:model-changed", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    const cleanupDownload = window.llama?.onDownloadComplete?.(refresh);
    return () => {
      alive = false;
      window.removeEventListener("osiris:model-changed", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      cleanupDownload?.();
    };
  }, []);
  const localOptions = localModels.map((model) => ({
    type: "local", modelPath: model.fullPath, name: model.filename,
  }));
  const cloudOptions = CLOUD_PROVIDERS.flatMap((provider) => getAllProviderModels(provider).map((model) => ({
    type: "cloud", provider: provider.id, model: model.id, name: provider.name + " - " + model.name,
  })));
  const customOptions = customServer.models.map((model) => ({
    type: "cloud", provider: CUSTOM_PROVIDER_ID, model, name: "Servidor proprio - " + model,
  }));
  const options = [...localOptions, ...customOptions, ...cloudOptions];
  const selected = data?.modelConfig;
  const value = selected ? workflowModelKey(selected) : data?.model ? "legacy" : "";
  const missing = selected && !options.some((option) => workflowModelKey(option) === value);
  const missingKey = selected?.type === "cloud" && selected.provider !== CUSTOM_PROVIDER_ID && !keys[selected.provider]?.trim();
  return <div className="flex min-w-0 flex-col gap-1">
    <select aria-label="Modelo do agente" value={value} disabled={disabled}
      onChange={(event) => onChange(options.find((option) => workflowModelKey(option) === event.target.value) || null)}
      className="nowheel max-w-[230px] cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 outline-none disabled:opacity-50">
      <option value="">Usar modelo ativo: {activeModel?.name || "nenhum"}</option>
      {data?.model && !selected && <option value="legacy" disabled>Selecione novamente: {data.model}</option>}
      {missing && <option value={value} disabled>{selected.name || selected.model || selected.modelPath} (indisponivel)</option>}
      <optgroup label="Local - modelos instalados">
        {localOptions.map((option) => <option key={workflowModelKey(option)} value={workflowModelKey(option)}>{option.name}</option>)}
      </optgroup>
      {customOptions.length > 0 && <optgroup label="Servidor proprio">
        {customOptions.map((option) => <option key={workflowModelKey(option)} value={workflowModelKey(option)}>{option.model}</option>)}
      </optgroup>}
      {CLOUD_PROVIDERS.map((provider) => <optgroup key={provider.id} label={"Nuvem - " + provider.name + (keys[provider.id]?.trim() ? "" : " (configure a chave)")}>
        {cloudOptions.filter((option) => option.provider === provider.id).map((option) => <option key={workflowModelKey(option)} value={workflowModelKey(option)} disabled={!keys[provider.id]?.trim()}>{option.name}</option>)}
      </optgroup>)}
    </select>
    {(error || missingKey || missing) && <span role="alert" className="max-w-[230px] text-[10px] text-amber-400">{error || (missingKey ? "Configure a chave deste provedor em Modelos." : "Modelo salvo indisponivel. Selecione outro modelo.")}</span>}
    <Link to="/modelos" className="text-[10px] text-violet-400">Configurar modelos locais e nuvem</Link>
  </div>;
}
