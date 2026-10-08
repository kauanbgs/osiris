import { useState, useRef, useEffect } from "react";

import { useParams, useNavigate } from "react-router-dom";

import {
  ArrowUp,
  Check,
  Code2,
  Copy,
  Cpu,
  FileText,
  Lightbulb,
  Mic,
  MicOff,
  Paperclip,
  Sparkles,
  Square,
  Terminal,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

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

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ui/reasoning";

import { Button } from "@/components/ui/button";

import sheets from "@/services/api";

import { useAuth } from "@/contexts/AuthContext";

import { getActiveModel } from "@/services/llmService";

import { useSpeech } from "react-text-to-speech";

import { copyToClipboard } from "@/lib/utils";

import { runMainAgent } from "@/services/agentBus";

// ==========================================
// BOTÃO DE VOZ
// ==========================================

function SpeakButton({ text }) {
  const { speechStatus, start, stop } = useSpeech({ text });

  const isPlaying = speechStatus === "started";

  return (
    <button
      type="button"
      title={isPlaying ? "Parar leitura" : "Ouvir mensagem"}
      onClick={isPlaying ? stop : start}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-700/50 hover:text-zinc-200"
    >
      {isPlaying ? (
        <VolumeX className="size-3.5" />
      ) : (
        <Volume2 className="size-3.5" />
      )}
    </button>
  );
}

// ==========================================
// BOTÃO DE COPIAR
// ==========================================

function CopyMessageButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;

    const success = await copyToClipboard(text);

    if (success) {
      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <MessageAction tooltip={copied ? "Copiado!" : "Copiar"}>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className={`h-7 w-7 transition-colors ${
          copied
            ? "text-emerald-400 hover:text-emerald-300"
            : "text-zinc-500 hover:text-zinc-200"
        }`}
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </MessageAction>
  );
}

// ==========================================
// HOME
// ==========================================

export default function Home() {
  const [memories, setMemories] = useState([]);

  useEffect(() => {
    async function loadMemories() {
      try {
        const response = await sheets.getMemory();

        console.log("Memórias carregadas:", response.data.memories);

        setMemories(response.data.memories);
      } catch (e) {
        console.error("Erro ao carregar memórias:", e);
      }
    }

    loadMemories();
  }, []);

  const { id } = useParams();

  const navigate = useNavigate();

  const { user } = useAuth();

  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const [files, setFiles] = useState([]);

  const [activeModel, setActiveModel] = useState(getActiveModel);

  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef(null);

  const recognitionRef = useRef(null);

  const uploadInputRef = useRef(null);

  const creatingChatRef = useRef(false);

  // ==========================================
  // DATA / SAUDAÇÃO
  // ==========================================

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

  // ==========================================
  // SPEECH TO TEXT
  // ==========================================

  const shouldStopRef = useRef(false);

  const accumulatedTextRef = useRef("");

  function startRecognition(SpeechRecognition, baseText) {
    const recognition = new SpeechRecognition();

    recognitionRef.current = recognition;

    recognition.lang = "pt-BR";

    recognition.interimResults = true;

    recognition.maxAlternatives = 1;

    recognition.continuous = true;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal) {
          accumulatedTextRef.current += result[0].transcript + " ";
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setInput(
        (baseText ? baseText + " " : "") +
          accumulatedTextRef.current +
          interimTranscript,
      );
    };

    recognition.onerror = (e) => {
      if (e.error === "aborted") {
        return;
      }

      if (!shouldStopRef.current) {
        setTimeout(() => startRecognition(SpeechRecognition, baseText), 200);
      } else {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (!shouldStopRef.current) {
        setTimeout(() => startRecognition(SpeechRecognition, baseText), 100);
      } else {
        setIsListening(false);
      }
    };

    recognition.start();
  }

  async function handleMicToggle() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz.");

      return;
    }

    if (isListening) {
      shouldStopRef.current = true;

      recognitionRef.current?.stop();

      accumulatedTextRef.current = "";

      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      stream.getTracks().forEach((t) => t.stop());
    } catch {
      alert(
        "Permissão de microfone negada. Verifique as configurações do sistema.",
      );

      return;
    }

    shouldStopRef.current = false;

    accumulatedTextRef.current = "";

    const baseText = input;

    startRecognition(SpeechRecognition, baseText);
  }

  useEffect(() => {
    return () => {
      shouldStopRef.current = true;

      recognitionRef.current?.abort();
    };
  }, []);

  // ==========================================
  // MODELO ATIVO
  // ==========================================

  useEffect(() => {
    const handleModelChange = () => {
      setActiveModel(getActiveModel());
    };

    window.addEventListener("osiris:model-changed", handleModelChange);

    return () => {
      window.removeEventListener("osiris:model-changed", handleModelChange);
    };
  }, []);

  // ==========================================
  // PARSER DE REASONING
  // ==========================================

  function parseReasoning(text = "") {
    const closedMatch = text.match(/<think>([\s\S]*?)<\/think>/i);

    if (closedMatch) {
      return {
        reasoning: closedMatch[1].trim(),

        content: text.replace(closedMatch[0], "").trim(),
      };
    }

    const openMatch = text.match(/<think>([\s\S]*)$/i);

    if (openMatch) {
      return {
        reasoning: openMatch[1].trim(),

        content: "",
      };
    }

    return {
      reasoning: "",
      content: text.trim(),
    };
  }

  // ==========================================
  // CARREGA MENSAGENS
  // ==========================================

  useEffect(() => {
    if (!id) {
      setMessages([]);

      return;
    }

    if (creatingChatRef.current) {
      creatingChatRef.current = false;

      return;
    }

    async function loadMessages() {
      try {
        const response = await sheets.getMessages(id);

        const raw = response.data?.messages || [];

        const formatted = raw.map((msg) => {
          const isBot = msg.type !== "user";

          const parsed = isBot
            ? parseReasoning(msg.content)
            : {
                reasoning: "",
                content: msg.content,
              };

          return {
            id: msg.id_message,

            sender: isBot ? "Osiris" : user?.name || "Usuário",

            isBot,

            content: parsed.content,

            reasoning: parsed.reasoning,

            isStreaming: false,

            agentStatus: null,
          };
        });

        setMessages(formatted);
      } catch (error) {
        console.error("Erro ao carregar mensagens do chat:", error);
      }
    }

    loadMessages();
  }, [id, user?.name]);

  // ==========================================
  // AUTO SCROLL
  // ==========================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // ==========================================
  // SUBMIT
  // ==========================================

  async function handleSubmit() {
    if ((!input.trim() && files.length === 0) || isLoading) {
      return;
    }

    const promptText = input.trim();

    const content =
      files.length > 0
        ? `${promptText}\n\n📎 ${files.map((f) => f.name).join(", ")}`
        : promptText;

    setInput("");

    setFiles([]);

    setIsLoading(true);

    let currentChatId = id;

    // ========================================
    // CRIA CHAT
    // ========================================

    if (!currentChatId) {
      try {
        creatingChatRef.current = true;

        const title =
          promptText.length > 30
            ? promptText.slice(0, 30) + "..."
            : promptText || "Novo chat";

        const response = await sheets.postChat({
          title,
        });

        const newChat = response.data?.chat || response.data;

        if (newChat?.id_chat) {
          currentChatId = newChat.id_chat;

          window.dispatchEvent(new CustomEvent("osiris:chats-updated"));

          navigate(`/home/${currentChatId}`, {
            replace: true,
          });
        }
      } catch (err) {
        console.error("Erro ao criar chat:", err);
      }
    }

    // ========================================
    // MENSAGEM DO USUÁRIO
    // ========================================

    const userMessage = {
      content,

      sender: user?.name || "Usuário",

      isBot: false,
    };

    // ========================================
    // ADICIONA MENSAGEM + BOT TEMPORÁRIO
    // ========================================

    setMessages((prev) => [
      ...prev,

      userMessage,

      {
        content: "",

        reasoning: "",

        sender: "Osiris",

        isBot: true,

        isStreaming: true,

        agentStatus: {
          type: "starting",

          agent: null,

          label: "Iniciando...",
        },
      },
    ]);

    // ========================================
    // SALVA MENSAGEM DO USUÁRIO
    // ========================================

    if (currentChatId) {
      try {
        await sheets.postMessage(currentChatId, {
          type: "user",

          content,
        });
      } catch (err) {
        console.error("Erro ao salvar mensagem do usuário:", err);
      }
    }

    try {
      // ======================================
      // HISTORY
      // ======================================

      const history = messages.map((m) => ({
        role: m.isBot ? "assistant" : "user",

        content: m.content || "",
      }));

      // ======================================
      // EXECUTA SISTEMA MULTIAGENTE
      // ======================================

      const finalBotText = await runMainAgent({
        prompt: content,

        history,

        memory: memories,

        // ==================================
        // STREAM
        // ==================================

        onChunk: (accumulated) => {
          const parsed = parseReasoning(accumulated);

          setMessages((prev) => {
            const updated = [...prev];

            const lastIdx = updated.length - 1;

            if (lastIdx >= 0 && updated[lastIdx].isBot) {
              updated[lastIdx] = {
                ...updated[lastIdx],

                content: parsed.content,

                reasoning: parsed.reasoning,

                isStreaming: true,
              };
            }

            return updated;
          });
        },

        // ==================================
        // STATUS DOS AGENTES
        // ==================================

        onStatus: (event) => {
          console.log("[CHAT] Agent status:", event);

          setMessages((prev) => {
            const updated = [...prev];

            const lastIdx = updated.length - 1;

            if (lastIdx >= 0 && updated[lastIdx].isBot) {
              updated[lastIdx] = {
                ...updated[lastIdx],

                agentStatus: event,

                isStreaming: true,
              };
            }

            return updated;
          });
        },
      });

      // ======================================
      // FINALIZA MENSAGEM
      // ======================================

      const parsed = parseReasoning(finalBotText);

      setMessages((prev) => {
        const updated = [...prev];

        const lastIdx = updated.length - 1;

        if (lastIdx >= 0 && updated[lastIdx].isBot) {
          updated[lastIdx] = {
            ...updated[lastIdx],

            content: parsed.content || "...",

            reasoning: parsed.reasoning,

            isStreaming: false,

            agentStatus: {
              type: "done",

              agent: "main",

              label: "Resposta concluída.",
            },
          };
        }

        return updated;
      });

      // ======================================
      // SALVA RESPOSTA
      // ======================================

      if (currentChatId && finalBotText) {
        try {
          await sheets.postMessage(currentChatId, {
            type: "assistant",

            content: finalBotText,
          });
        } catch (err) {
          console.error("Erro ao salvar resposta do assistente:", err);
        }
      }

      // ======================================
      // RECARREGA MEMÓRIA
      // ======================================

      try {
        const memRes = await sheets.getMemory();

        if (memRes?.data?.memories) {
          setMemories(memRes.data.memories);
        }
      } catch (memErr) {
        console.error("Erro ao recarregar memórias:", memErr);
      }
    } catch (err) {
      // ======================================
      // ERRO
      // ======================================

      setMessages((prev) => {
        const updated = [...prev];

        const lastIdx = updated.length - 1;

        if (lastIdx >= 0 && updated[lastIdx].isBot) {
          updated[lastIdx] = {
            content: `⚠️ ${
              err.message || "Erro ao gerar resposta com o modelo."
            }`,

            reasoning: "",

            sender: "Osiris",

            isBot: true,

            isStreaming: false,

            agentStatus: {
              type: "error",

              agent: null,

              label: "Ocorreu um erro.",
            },
          };
        }

        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ==========================================
  // ARQUIVOS
  // ==========================================

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

  // ==========================================
  // SUGESTÕES
  // ==========================================

  const promptSuggestions = [
    {
      icon: Code2,

      label: "Explicar código",

      prompt: "Pode me ajudar a entender e otimizar este código?",
    },

    {
      icon: FileText,

      label: "Criar um resumo",

      prompt: "Escreva um resumo conciso com os pontos principais sobre ",
    },

    {
      icon: Terminal,

      label: "Escrever um script",

      prompt: "Crie um script em Python para automatizar ",
    },

    {
      icon: Lightbulb,

      label: "Ideias de projeto",

      prompt: "Me dê ideias criativas de projetos usando IA e React ",
    },
  ];

  // ==========================================
  // UI
  // ==========================================

  return (
    <section className="relative flex h-full flex-col overflow-hidden text-white">
      {/* Área de conteúdo */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        {!hasMessages && (
          <div className="flex min-h-full items-center justify-center px-6 py-12">
            <div className="relative z-10 -mt-10 w-full max-w-180">
              <header className="mb-8 text-center">
                <h1 className="text-[clamp(26px,3vw,38px)] font-semibold tracking-tight text-zinc-200">
                  {greeting},{" "}
                  <span className="font-bold text-violet-500">
                    {user?.name || "Usuário"}
                  </span>
                  !
                </h1>

                <p className="mt-2 text-[11px] font-semibold font-mono text-zinc-400">
                  {date}
                </p>
              </header>
            </div>
          </div>
        )}

        {/* Mensagens */}
        {hasMessages && (
          <div className="mx-auto w-full max-w-180 space-y-6 px-6 py-6">
            {messages.map((msg, i) => (
              <div
                key={msg.id || i}
                style={{
                  animation: "messageIn 0.3s ease-out both",
                }}
              >
                {msg.isBot ? (
                  <Message>
                    <MessageAvatar
                      fallback="O"
                      className="bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/20"
                    />

                    <div className="flex-1 space-y-3 min-w-0">
                      {/* Reasoning */}
                      {msg.reasoning && (
                        <Reasoning isStreaming={msg.isStreaming}>
                          <ReasoningTrigger>
                            {msg.isStreaming && !msg.content
                              ? "Pensando..."
                              : "Raciocínio"}
                          </ReasoningTrigger>

                          <ReasoningContent markdown>
                            {msg.reasoning}
                          </ReasoningContent>
                        </Reasoning>
                      )}

                      {/* =================================
                            STATUS DOS AGENTES
                        ================================= */}

                      {msg.isStreaming && !msg.content && !msg.reasoning && (
                        <div className="flex items-center gap-2 py-1 text-xs font-mono text-zinc-400">
                          {/* Bolinha */}
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />

                            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
                          </span>

                          {/* Status */}
                          <span className="transition-all duration-300">
                            {msg.agentStatus?.label || "Pensando..."}
                          </span>
                        </div>
                      )}

                      {/* Resposta */}
                      {msg.content && (
                        <MessageContent markdown className="text-zinc-100">
                          {msg.content}
                        </MessageContent>
                      )}

                      {/* Actions */}
                      {msg.content && (
                        <MessageActions className="pt-1">
                          <CopyMessageButton text={msg.content} />

                          {!msg.isStreaming && (
                            <MessageAction tooltip="Ouvir mensagem">
                              <SpeakButton text={msg.content} />
                            </MessageAction>
                          )}
                        </MessageActions>
                      )}
                    </div>
                  </Message>
                ) : (
                  <Message className="justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-violet-600/20 border border-violet-500/30 px-4 py-2.5 text-sm text-zinc-100 shadow-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                  </Message>
                )}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* =====================================
          INPUT
      ===================================== */}

      <div className="shrink-0 px-6 pb-5 pt-3">
        <div className="mx-auto w-full max-w-180">
          {/* Modelo ativo */}
          <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-mono text-zinc-500">
            <div className="flex items-center gap-1.5">
              {activeModel?.type === "cloud" ? (
                <Sparkles size={12} className="text-violet-400" />
              ) : (
                <Cpu size={12} className="text-violet-400" />
              )}

              <span>
                Modelo:{" "}
                <strong className="font-semibold text-zinc-300">
                  {activeModel?.name || "Automático"}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate("/modelos")}
              className="text-zinc-500 transition-colors hover:text-violet-400"
            >
              Configurar modelos →
            </button>
          </div>

          <PromptInput
            value={input}
            onValueChange={setInput}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            className="w-full max-w-(--breakpoint-md) bg-zinc-800/20 border-0 text-white"
          >
            {/* Arquivos */}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="bg-white/10 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Paperclip className="size-4" />

                    <span className="max-w-[120px] truncate">{file.name}</span>

                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="hover:bg-secondary/50 rounded-full p-1"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <PromptInputTextarea
              placeholder="Pergunte qualquer coisa ao Osiris..."
              className="text-white"
            />

            <PromptInputActions className="flex items-center justify-between gap-2 pt-2">
              {/* Esquerda */}
              <div className="flex items-center gap-1">
                <PromptInputAction tooltip="Anexar arquivos">
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

                    <Paperclip className="text-white size-5" />
                  </label>
                </PromptInputAction>

                {/* Microfone */}
                <PromptInputAction
                  tooltip={isListening ? "Parar gravação" : "Falar mensagem"}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={handleMicToggle}
                    className={`h-8 w-8 rounded-full transition-all ${
                      isListening
                        ? "bg-red-500/20 text-red-400 animate-pulse ring-1 ring-red-500/40"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="size-4" />
                    ) : (
                      <Mic className="size-4" />
                    )}
                  </Button>
                </PromptInputAction>
              </div>

              {/* Enviar */}
              <PromptInputAction
                tooltip={isLoading ? "Gerando..." : "Enviar mensagem"}
              >
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-white text-black"
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
