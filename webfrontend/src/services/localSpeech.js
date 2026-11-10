// Transcrição de voz 100% local (Whisper via @huggingface/transformers, em Web Worker).
// Substitui o SpeechRecognition do navegador, que não funciona no Electron.

let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (worker) return worker;

  worker = new Worker(new URL("../workers/whisperWorker.js", import.meta.url), { type: "module" });

  worker.onmessage = ({ data }) => {
    const job = pending.get(data.id);

    if (data.type === "progress") {
      // progress não tem id: avisa todos os pedidos em andamento
      for (const item of pending.values()) item.onStatus?.(data.progress);
      return;
    }
    if (!job) return;

    if (data.type === "transcribing") {
      job.onStatus?.({ status: "transcribing" });
    } else if (data.type === "result") {
      pending.delete(data.id);
      job.resolve(data.text);
    } else if (data.type === "error") {
      pending.delete(data.id);
      job.reject(new Error(data.message));
    }
  };

  worker.onerror = (event) => {
    for (const job of pending.values()) job.reject(new Error(event.message || "Erro no Whisper local."));
    pending.clear();
    worker = null;
  };

  return worker;
}

// Whisper espera áudio mono em 16 kHz (Float32).
async function decodeTo16kMono(blob) {
  const context = new AudioContext({ sampleRate: 16000 });
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    return decoded.getChannelData(0);
  } finally {
    context.close();
  }
}

export async function transcribeLocal(blob, { language = "portuguese", onStatus } = {}) {
  const audio = await decodeTo16kMono(blob);
  const id = nextId++;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onStatus });
    getWorker().postMessage({ id, audio, language }, [audio.buffer]);
  });
}
