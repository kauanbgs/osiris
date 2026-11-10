import { pipeline, env } from "@huggingface/transformers";

// Whisper local: o modelo é baixado na primeira vez e fica em cache (offline depois).
env.allowLocalModels = false;

const MODEL = "Xenova/whisper-base";
let recognizer = null;

async function getRecognizer() {
  recognizer ??= await pipeline("automatic-speech-recognition", MODEL, {
    progress_callback: (progress) => self.postMessage({ type: "progress", progress }),
  });
  return recognizer;
}

self.onmessage = async ({ data }) => {
  const { id, audio, language } = data;
  try {
    const asr = await getRecognizer();
    self.postMessage({ type: "transcribing", id });
    const output = await asr(audio, { language, task: "transcribe", chunk_length_s: 30 });
    self.postMessage({ type: "result", id, text: (output.text || "").trim() });
  } catch (error) {
    self.postMessage({ type: "error", id, message: error?.message || String(error) });
  }
};
