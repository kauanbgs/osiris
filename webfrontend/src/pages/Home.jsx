import { useState, useRef, useEffect } from "react";
import { ArrowUp, Copy, Paperclip, Square, X } from "lucide-react";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const messagesEndRef = useRef(null);
  const uploadInputRef = useRef(null);
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const date = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(now)
    .replace(",", " ·");

  const hasMessages = messages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit() {
    if ((!input.trim() && files.length === 0) || isLoading) return;

    const content = files.length > 0
      ? `${input}\n\n📎 ${files.map((f) => f.name).join(", ")}`
      : input;

    const userMessage = { content, sender: "Kauan", isBot: false };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setFiles([]);
    setIsLoading(true);

    // Simula resposta do bot
    setTimeout(() => {
      const botMessage = {
        content: `Entendido! Vou processar sua solicitação: "${userMessage.content}"`,
        sender: "Osiris",
        isBot: true,
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsLoading(false);
    }, 800);
  }

  function handleFileChange(event) {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  }

  function handleRemoveFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (uploadInputRef?.current) {
      uploadInputRef.current.value = "";
    }
  }

  return (
    <section className="relative flex h-full flex-col overflow-hidden text-white">
      {/* Área de conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto">
        {/* Header de saudação — só aparece sem mensagens */}
        {!hasMessages && (
          <div className="flex min-h-full items-center justify-center px-6 py-12">
            <div className="relative z-10 -mt-14 w-full max-w-180 font-mono">
              <header className="mb-10 text-center">
                <h1 className="text-[clamp(26px,3vw,38px)] font-semibold tracking-tight text-zinc-200">
                  {greeting},{" "}
                  <span className="font-bold text-violet-500">Kauan</span>!
                </h1>
                <p className="mt-2 text-[11px] font-semibold text-zinc-300">
                  {date}
                </p>
              </header>
            </div>
          </div>
        )}

        {/* Lista de mensagens */}
        {hasMessages && (
          <div className="mx-auto w-full max-w-180 space-y-6 px-6 py-6">
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{ animation: "messageIn 0.3s ease-out both" }}
              >
                {msg.isBot ? (
                  /* Mensagem do bot — alinhada à esquerda */
                  <Message>
                    <MessageAvatar
                      fallback="O"
                      className="bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/20"
                    />
                    <div className="flex-1 space-y-2">
                      <MessageContent
                        markdown
                        className="bg-transparent text-white"
                      >
                        {msg.content}
                      </MessageContent>
                      <MessageActions>
                        <MessageAction tooltip="Copiar">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-500 hover:text-zinc-200"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </MessageAction>
                      </MessageActions>
                    </div>
                  </Message>
                ) : (
                  /* Mensagem do usuário — alinhada à direita */
                  <Message className="justify-end">
                    <MessageContent className="bg-transparent text-white">
                      {msg.content}
                    </MessageContent>
                  </Message>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input fixo no fundo */}
      <div className="shrink-0 px-6 pb-5 pt-3">
        <div className="mx-auto w-full max-w-180">
          <PromptInput
            value={input}
            onValueChange={setInput}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            className="w-full max-w-(--breakpoint-md) bg-zinc-700/20"
          >
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="bg-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Paperclip className="size-4" />
                    <span className="max-w-[120px] truncate">{file.name}</span>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="hover:bg-secondary/50 rounded-full p-1"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <PromptInputTextarea placeholder="Ask me anything..." />

            <PromptInputActions className="flex items-center justify-between gap-2 pt-2">
              <PromptInputAction tooltip="Attach files">
                <label
                  htmlFor="file-upload"
                  className="hover:bg-secondary-foreground/10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl"
                >
                  <input
                    ref={uploadInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <Paperclip className="text-primary size-5" />
                </label>
              </PromptInputAction>

              <PromptInputAction
                tooltip={isLoading ? "Stop generation" : "Send message"}
              >
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={handleSubmit}
                >
                  {isLoading ? (
                    <Square className="size-5 fill-current" />
                  ) : (
                    <ArrowUp className="size-5" />
                  )}
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </section>
  );
}