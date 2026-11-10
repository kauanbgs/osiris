import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { getActiveModel, sendPrompt } from "@/services/llmService";

const SYSTEM_PROMPT = `Você é um assistente de edição de arquivos dentro de um editor.
Você recebe o arquivo atual e uma instrução do usuário.

REGRAS:
- Se a instrução pedir para alterar/criar/corrigir o arquivo, responda com UMA frase curta
  explicando o que mudou e, em seguida, o arquivo COMPLETO já alterado dentro de:
<file>
...conteúdo completo do arquivo...
</file>
- Nunca use cercas de markdown (\`\`\`) dentro de <file>. Não omita trechos nem use "...".
- Se a instrução for apenas uma pergunta sobre o arquivo, responda normalmente e NÃO use <file>.`;

function extractFile(text) {
  const match = text.match(/<file>\r?\n?([\s\S]*?)\r?\n?<\/file>/i);
  return match ? match[1] : null;
}

/**
 * Mesmo input da Home, mas ligado ao arquivo aberto: manda o conteúdo atual
 * como contexto e devolve o arquivo alterado via onApply (o pai atualiza o editor).
 */
export default function FileAssistantInput({ file, onApply, onBusyChange }) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef(null);

  // Avisa o pai (trava o editor) e conta os segundos enquanto a IA trabalha.
  useEffect(() => {
    onBusyChange?.(isLoading);
    if (!isLoading) return undefined;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Troca de arquivo: descarta a resposta anterior.
  useEffect(() => {
    setReply("");
  }, [file?.filePath]);

  async function handleSubmit() {
    const instruction = input.trim();
    if (!instruction || isLoading || !file) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setReply("");
    setInput("");

    const prompt = `ARQUIVO: ${file.fileName}
CAMINHO: ${file.filePath}

CONTEÚDO ATUAL:
<current_file>
${file.fileContent}
</current_file>

INSTRUÇÃO DO USUÁRIO:
${instruction}`;

    try {
      const result = await sendPrompt({
        prompt,
        systemPrompt: SYSTEM_PROMPT,
        signal: controller.signal,
      });
      const text = typeof result === "string" ? result : result?.text ?? String(result ?? "");
      const newContent = extractFile(text);

      if (newContent !== null) {
        onApply(newContent);
        setReply(text.replace(/<file>[\s\S]*?<\/file>/i, "").trim() || "Arquivo atualizado.");
      } else {
        setReply(text.trim());
      }
    } catch (error) {
      if (error?.name !== "AbortError") setReply(`Erro: ${error?.message || error}`);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }

  const model = getActiveModel();

  return (
    <div className="shrink-0 border-t border-border bg-background/40 px-4 py-3">
      {isLoading && (
        <div
          role="status"
          className="mx-auto mb-2 flex w-full max-w-(--breakpoint-md) items-center gap-2 rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-300 ring-1 ring-violet-500/20"
        >
          <Loader2 className="size-3.5 animate-spin" />
          <span className="animate-pulse">
            O Osiris está editando {file.fileName}...
          </span>
          <span className="ml-auto tabular-nums text-violet-400/70">{elapsed}s</span>
        </div>
      )}

      {!isLoading && reply && (
        <p className="mx-auto mb-2 max-h-24 w-full max-w-(--breakpoint-md) overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
          {reply}
        </p>
      )}

      <div className="mx-auto mb-1 flex w-full max-w-(--breakpoint-md) justify-between text-[11px] text-muted-foreground">
        <span>
          Editando <strong className="text-foreground">{file.fileName}</strong> · Modelo:{" "}
          <strong className="text-foreground">{model?.name || "Automático"}</strong>
        </span>
        <span>Alterações vão para o editor — salve com Ctrl+S</span>
      </div>

      <PromptInput
        value={input}
        onValueChange={setInput}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-(--breakpoint-md) border-0 bg-muted/20 text-foreground"
      >
        <PromptInputTextarea
          placeholder="Peça uma alteração neste arquivo..."
          className="text-foreground"
        />
        <PromptInputActions className="flex items-center justify-end gap-2 pt-2">
          <PromptInputAction tooltip={isLoading ? "Parar resposta" : "Enviar"}>
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8 rounded-full bg-action text-action-foreground"
              onClick={isLoading ? () => abortRef.current?.abort() : handleSubmit}
              aria-label={isLoading ? "Parar resposta" : "Enviar"}
            >
              {isLoading ? <Square className="size-5 fill-current" /> : <ArrowUp className="size-5" />}
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    </div>
  );
}
