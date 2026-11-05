import { api } from "@/services/api";

// Tema = CSS escrito pelo usuario. Fica no localStorage (por maquina).
// { css: "CSS aplicado agora", themes: [{ id, name, css }] }
const KEY = "osiris-theme";

export const CSS_TEMPLATE = `:root {
  --background: #141414;
  --foreground: #e7e0ed;
  --card: #211e27;
  --primary: #8b5cf6;
  --primary-foreground: #ffffff;
  --secondary: #10b981;
  --destructive: #ff6b6b;
  --muted: #2d2932;
  --muted-foreground: #cbc3d7;
  --accent: #2a2531;
  --accent-foreground: #d0bcff;
  --border: #413b49;
  --radius: 0.625rem;

  /* barra lateral */
  --sidebar: #121212;
  --sidebar-foreground: #cbc3d7;
  --sidebar-accent: #211e27;
  --sidebar-accent-foreground: #e7e0ed;
  --sidebar-primary: #8b5cf6;
  --sidebar-border: #2d2932;

  /* pontinhos do login/cadastro */
  /* botão de enviar e ações principais (padrão: branco/preto) */
  --color-action: #ffffff;
  --color-action-foreground: #000000;

  --dot-from: #a855f7;
  --dot-to: #b497cf;
  --dot-glow: color-mix(in srgb, var(--primary) 14%, transparent);

  /* destaques (botões, links, avisos) derivados das cores acima */
  --color-violet-300: color-mix(in oklab, var(--primary) 60%, white);
  --color-violet-400: color-mix(in oklab, var(--primary) 80%, white);
  --color-violet-500: var(--primary);
  --color-violet-600: color-mix(in oklab, var(--primary) 88%, black);
  --color-violet-700: color-mix(in oklab, var(--primary) 72%, black);
  --color-emerald-400: color-mix(in oklab, var(--secondary) 80%, white);
  --color-emerald-500: var(--secondary);
  --color-red-400: color-mix(in oklab, var(--destructive) 85%, white);
  --color-red-500: var(--destructive);
}

/* a barra lateral também pode ser alterada direto: */
/* #osiris-sidebar { width: 14rem; } */
`;

const empty = { css: "", themes: [] };

export function loadTheme() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { css: typeof data.css === "string" ? data.css : "", themes: Array.isArray(data.themes) ? data.themes : [] };
  } catch {
    return { ...empty };
  }
}

export function saveTheme(theme) {
  localStorage.setItem(KEY, JSON.stringify(theme));
}

const IMG_KEY = "osiris-theme-image";

export function loadImage() {
  return localStorage.getItem(IMG_KEY) || "";
}

// Retorna false se nao coube no armazenamento.
export function saveImage(src) {
  try {
    if (src) localStorage.setItem(IMG_KEY, src);
    else localStorage.removeItem(IMG_KEY);
    return true;
  } catch {
    return false;
  }
}

// Reduz a imagem (max 1920px, jpeg) para caber no localStorage.
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Imagem inválida.")); };
    img.src = url;
  });
}

function styleTag(id) {
  let tag = document.getElementById(id);
  if (!tag) {
    tag = document.createElement("style");
    tag.id = id;
    document.head.appendChild(tag);
  }
  return tag;
}

// A imagem vem antes do CSS do usuario, que pode sobrescrever tudo.
// Dentro do CSS use: background: var(--osiris-bg-image)
export function applyTheme(theme = loadTheme(), image = loadImage()) {
  const imgTag = styleTag("osiris-bg-image");
  const cssTag = styleTag("osiris-custom-css");
  imgTag.textContent = image
    ? `:root { --osiris-bg-image: url("${image.replace(/["\\\n\r]/g, "")}"); --background: transparent; }
html, body { background-image: var(--osiris-bg-image); background-size: cover; background-position: center;
  background-attachment: fixed; background-repeat: no-repeat; }`
    : "";
  cssTag.textContent = theme.css || "";
  window.dispatchEvent(new Event("osiris-theme-change"));
}

// Variaveis enviadas ao celular, que nao interpreta CSS.
const SYNCED_COLORS = {
  background: "--background",
  card: "--card",
  input: "--input",
  border: "--border",
  foreground: "--foreground",
  mutedForeground: "--muted-foreground",
  primary: "--primary",
  secondary: "--secondary",
  destructive: "--destructive",
  accent: "--accent",
  accentForeground: "--accent-foreground",
};

// O canvas resolve qualquer cor do CSS (nome, hsl, color-mix) e mistura a
// transparencia sobre o fundo, resultando sempre em #rrggbb. Um valor invalido
// e ignorado pelo canvas e sobra a cor de baixo.
function readThemeColors() {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const css = getComputedStyle(document.body);

  function paint(color, under) {
    context.fillStyle = under;
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = color || under;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }
  const toHex = (variable, under) => paint(css.getPropertyValue(variable).trim(), under);

  // Com imagem de fundo, --background costuma ser transparente e as superficies,
  // translucidas. O celular nao tem a imagem: vale a cor do body e, sem ela, uma
  // base clara se o texto do tema e escuro, para ele continuar legivel.
  const foreground = toHex(SYNCED_COLORS.foreground, "#808080");
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(foreground.slice(start, start + 2), 16));
  const hasDarkText = (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  const base = paint(css.backgroundColor, hasDarkText ? "#f4f2f7" : "#141414");

  const background = toHex(SYNCED_COLORS.background, base);
  return Object.fromEntries(
    Object.entries(SYNCED_COLORS).map(([key, variable]) => [
      key,
      key === "background" ? background : toHex(variable, background),
    ]),
  );
}

let publishTimer;

// Espera a digitacao no editor de CSS parar antes de enviar.
export function publishThemeColors() {
  if (!localStorage.getItem("osiris_token")) return;
  clearTimeout(publishTimer);
  publishTimer = setTimeout(async () => {
    const colors = readThemeColors();
    if (!colors) return;
    try {
      await api.put("/theme", { colors });
    } catch (error) {
      console.warn("Nao foi possivel enviar o tema ao celular:", error.message);
    }
  }, 500);
}

// Ao entrar na conta: envia so um tema personalizado, para um computador com as
// cores de fabrica nao apagar o tema escolhido em outro.
export function publishCustomTheme() {
  if (loadTheme().css || loadImage()) publishThemeColors();
}
