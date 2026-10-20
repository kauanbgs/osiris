export function parseResetDuration(value) {
  if (!value) return 0;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value) * 1000;
  let total = 0;
  for (const match of value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)) {
    total += Number(match[1]) * ({ ms: 1, s: 1000, m: 60000, h: 3600000 }[match[2]]);
  }
  return total;
}

export async function abortableDelay(ms, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason || new DOMException("Interrompido", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export function createGroqRateLimiter({ now = Date.now, delay = abortableDelay } = {}) {
  let queue = Promise.resolve();
  // A model shares its token budget with every chat and agent using it.
  const budgets = new Map();
  return function schedule({ model, estimatedTokens, signal, onNotice, request }) {
    const execute = async () => {
      signal?.throwIfAborted();
      for (let attempt = 0; attempt < 3; attempt++) {
        const budget = budgets.get(model);
        if (budget && budget.remaining < estimatedTokens && budget.resetAt > now()) {
          const wait = budget.resetAt - now();
          onNotice?.({ type: "rate-limit", message: "Aguardando a cota de tokens do Groq liberar (" + Math.ceil(wait / 1000) + "s).", waitMs: wait });
          await delay(wait, signal);
          budgets.delete(model);
        }
        signal?.throwIfAborted();
        const response = await request();
        const remaining = response.headers.get("x-ratelimit-remaining-tokens");
        const reset = parseResetDuration(response.headers.get("x-ratelimit-reset-tokens"));
        if (remaining !== null && reset) budgets.set(model, { remaining: Number(remaining), resetAt: now() + reset + 250 });
        if (response.status !== 429) return response;
        const body = await response.clone().json().catch(() => ({}));
        const message = body.error?.message || "Limite do Groq atingido.";
        if (/request too large|tokens per day|requests per day|\bTPD\b|\bRPD\b|daily|quota|billing/i.test(message)) {
          throw new Error("Groq: " + message + " Reduza o contexto ou aguarde a renovacao da cota.");
        }
        const retryAfter = response.headers.get("retry-after");
        const duration = parseResetDuration(retryAfter) || (retryAfter ? Math.max(0, Date.parse(retryAfter) - now()) : 0) || reset || 60000;
        if (attempt === 2 || duration > 120000) throw new Error("Groq: " + message + " Tente novamente apos a renovacao da cota.");
        const wait = duration + 250;
        budgets.set(model, { remaining: 0, resetAt: now() + wait });
        onNotice?.({ type: "rate-limit", message: "Limite do Groq atingido. Nova tentativa em " + Math.ceil(wait / 1000) + "s.", waitMs: wait });
        await delay(wait, signal);
        budgets.delete(model);
      }
    };
    const result = queue.then(execute);
    queue = result.catch(() => {});
    return result;
  };
}

export const scheduleGroqRequest = createGroqRateLimiter();
