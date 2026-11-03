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
