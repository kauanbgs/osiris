// Valores visuais compartilhados por todas as telas e troca de tema.
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import sheets from "./services/api";

// Cor de fundo única do app (telas, navbar e transições entre telas).
export const BACKGROUND = "#0d0d0d";

// Respiro lateral para o conteúdo não ficar colado nas bordas do celular.
// Aplicado no navegador (App.js); a Navbar o compensa para ir de borda a borda.
export const SCREEN_PADDING = 12;

// Fonte das conversas com o agente (carregada no App.js com useFonts).
// No Android o fontWeight não troca de arquivo de fonte, então cada peso
// tem o próprio nome.
export const CHAT_FONT = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
};

// Cores de destaque (tipos de arquivo, seções, ícones). Não vêm do tema do
// desktop, mas escurecem em tema claro para continuar visíveis.
export const ACCENTS = {
  blue: "#60a5fa",
  green: "#34d399",
  amber: "#fbbf24",
  pink: "#f472b6",
  cyan: "#22d3ee",
};

const LIGHT_THEME_ACCENTS = {
  "#60a5fa": "#2563eb",
  "#4f9cff": "#2563eb",
  "#34d399": "#047857",
  "#fbbf24": "#b45309",
  "#f59e0b": "#b45309",
  "#f1c40f": "#b45309",
  "#f472b6": "#be185d",
  "#22d3ee": "#0e7490",
};

const THEME_STORAGE_KEY = "theme";
const DESKTOP_COLORS_STORAGE_KEY = "desktopThemeColors";
const DESKTOP_SYNC_INTERVAL_MS = 5000;

// Cores de fábrica do web (webfrontend/src/index.css). O desktop envia as
// mesmas chaves com o tema escolhido lá.
const WEB_DEFAULT_COLORS = {
  background: "#141414",
  card: "#211e27",
  input: "#2d2932",
  border: "#413b49",
  foreground: "#e7e0ed",
  mutedForeground: "#cbc3d7",
  primary: "#8b5cf6",
  secondary: "#10b981",
  destructive: "#ff6b6b",
  accent: "#2a2531",
  accentForeground: "#d0bcff",
};

function channels(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

// Mistura duas cores #rrggbb; amount = 0 devolve a primeira e 1, a segunda.
function mix(from, to, amount) {
  const target = channels(to);
  const mixed = channels(from).map((value, index) =>
    Math.round(value + (target[index] - value) * amount).toString(16).padStart(2, "0"));
  return `#${mixed.join("")}`;
}

function isLightColor(hex) {
  const [r, g, b] = channels(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

function luminance(hex) {
  const [r, g, b] = channels(hex)
    .map((value) => value / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

// As telas escrevem as cores do tema padrão. O tema web troca cada uma delas
// pela equivalente do web; cor fora da lista (branco, amarelo...) não muda.
export function buildWebPalette(desktopColors) {
  const WEB = { ...WEB_DEFAULT_COLORS, ...desktopColors };
  // Bordas translúcidas somem sem a imagem de fundo do desktop.
  if (contrast(WEB.border, WEB.card) < 1.2) WEB.border = mix(WEB.card, WEB.foreground, 0.18);
  // Tons sem variável própria no web, derivados para acompanhar o tema escolhido.
  const subtle = mix(WEB.foreground, WEB.background, 0.5);
  const primaryDim = mix(WEB.primary, "#000000", 0.28);
  const primaryDark = mix(WEB.primary, "#000000", 0.6);
  const destructiveLight = mix(WEB.destructive, "#ffffff", 0.25);

  return {
    // Fundos
    "#010101": WEB.background,
    "#0c0c0e": WEB.background,
    "#0d0d0d": WEB.background,
    "#101012": WEB.background,
    "#111111": WEB.background,
    "#111112": WEB.background,
    "#111114": WEB.background,
    "#121212": WEB.background,

    // Cartões e painéis
    "#141414": WEB.card,
    "#151515": WEB.card,
    "#161616": WEB.card,
    "#161617": WEB.card,
    "#16161a": WEB.card,
    "#171717": WEB.card,
    "#19191d": WEB.card,
    "#1a1a1a": WEB.card,
    "#1b1a1e": WEB.card,
    "#1b1b1e": WEB.card,
    "#1e1e24": WEB.card,
    "#1f1f1f": WEB.card,

    // Campos e superfícies elevadas
    "#1c1c1c": WEB.input,
    "#222222": WEB.input,
    "#222126": WEB.input,
    "#232323": WEB.input,
    "#242326": WEB.input,
    "#242424": WEB.input,
    "#24242e": WEB.input,
    "#25232a": WEB.input,

    // Bordas
    "#262626": WEB.border,
    "#27272a": WEB.border,
    "#282832": WEB.border,
    "#292929": WEB.border,
    "#2a2a2a": WEB.border,
    "#2c2c36": WEB.border,
    "#2f2f3a": WEB.border,
    "#303036": WEB.border,
    "#333333": WEB.border,
    "#35323b": WEB.border,
    "#38363b": WEB.border,
    "#3f3f46": WEB.border,

    // Texto principal (#fefefe é o branco de títulos e campos; o branco puro fica
    // para o texto sobre botões roxos, que continua branco em qualquer tema)
    "#fefefe": WEB.foreground,
    "#d0d0d0": WEB.foreground,
    "#d4d4d8": WEB.foreground,
    "#d8d5df": WEB.foreground,
    "#dddddd": WEB.foreground,
    "#ddd9e2": WEB.foreground,
    "#e4e4e7": WEB.foreground,
    "#e8e8e8": WEB.foreground,
    "#f0eff2": WEB.foreground,
    "#f0f0f0": WEB.foreground,
    "#f3f3f3": WEB.foreground,
    "#f3f3f6": WEB.foreground,

    // Texto secundário
    "#85818c": WEB.mutedForeground,
    "#888888": WEB.mutedForeground,
    "#8a8a8a": WEB.mutedForeground,
    "#9a9a9a": WEB.mutedForeground,
    "#a1a1aa": WEB.mutedForeground,
    "#c8c5ce": WEB.mutedForeground,
    "#c9c9c9": WEB.mutedForeground,
    "#cccccc": WEB.mutedForeground,

    // Texto apagado, ícones inativos e placeholders
    "#444444": subtle,
    "#4b4652": subtle,
    "#4b4b4b": subtle,
    "#52525b": subtle,
    "#555555": subtle,
    "#5f5a64": subtle,
    "#615d67": subtle,
    "#666666": subtle,
    "#6a6a6a": subtle,
    "#6b6b6b": subtle,
    "#71717a": subtle,
    "#77737c": subtle,

    // Roxos
    "#7c3aed": WEB.primary,
    "#7c5cff": WEB.primary,
    "#8a56ff": WEB.primary,
    "#8b5cf6": WEB.primary,
    "#4a3f80": primaryDim,
    "#3a2d70": primaryDark,
    "#1a1030": WEB.accent,
    "#1e1a2e": WEB.accent,
    "#2a2440": WEB.accent,
    "#9d85ff": WEB.accentForeground,
    "#a78bfa": WEB.accentForeground,
    "#bb86fc": WEB.accentForeground,
    "#c084fc": WEB.accentForeground,
    "#c4b5fd": WEB.accentForeground,

    // Sucesso e erro
    "#10b981": WEB.secondary,
    "#2e7d32": WEB.secondary,
    "#2ecc71": WEB.secondary,
    "#a3e635": WEB.secondary,
    "#e74c3c": WEB.destructive,
    "#ef4444": WEB.destructive,
    "#f87171": WEB.destructive,
    "#fca5a5": destructiveLight,

    ...(isLightColor(WEB.background) ? LIGHT_THEME_ACCENTS : {}),
  };
}

export const THEMES = {
  padrao: { label: "Cores padrão" },
  web: { label: "Cores do web" },
};

const DEFAULT_THEME = "padrao";
const DEFAULT_PALETTE = {};

// Aceita #rgb, #rrggbb e #rrggbbaa. Demais valores passam direto.
function translateColor(value, palette) {
  if (typeof value !== "string" || !/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
    return value;
  }
  const hex = value.toLowerCase();
  const base = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex.slice(0, 7);
  const mapped = palette[base];
  if (!mapped) return value;
  return hex.length === 9 ? mapped + hex.slice(7) : mapped;
}

function translateStyles(value, palette) {
  if (Array.isArray(value)) return value.map((item) => translateStyles(item, palette));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, translateStyles(item, palette)]),
    );
  }
  return translateColor(value, palette);
}

const ThemeContext = createContext({
  themeId: DEFAULT_THEME,
  setThemeId: () => {},
  palette: DEFAULT_PALETTE,
  statusBarStyle: "light-content",
});

export function ThemeProvider({ children }) {
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME);
  const [desktopColors, setDesktopColors] = useState(null);
  const [ready, setReady] = useState(false);

  // Só desenha depois de ler o tema salvo, para não piscar as cores padrão.
  useEffect(() => {
    AsyncStorage.multiGet([THEME_STORAGE_KEY, DESKTOP_COLORS_STORAGE_KEY])
      .then(([[, savedTheme], [, savedColors]]) => {
        if (savedTheme && THEMES[savedTheme]) setThemeIdState(savedTheme);
        if (savedColors) setDesktopColors(JSON.parse(savedColors));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Acompanha o desktop enquanto o app está aberto e usando as cores do web.
  useEffect(() => {
    if (!ready || themeId !== "web") return undefined;
    let cancelled = false;
    let syncing = false;

    async function syncDesktopColors() {
      if (syncing || AppState.currentState !== "active") return;
      syncing = true;
      try {
        if (!(await AsyncStorage.getItem("token"))) return;
        const { data } = await sheets.getTheme();
        if (cancelled) return;
        const serialized = data.colors ? JSON.stringify(data.colors) : null;
        setDesktopColors((current) =>
          (current ? JSON.stringify(current) : null) === serialized ? current : data.colors);
        if (serialized) await AsyncStorage.setItem(DESKTOP_COLORS_STORAGE_KEY, serialized);
        else await AsyncStorage.removeItem(DESKTOP_COLORS_STORAGE_KEY);
      } catch {
        // Sem conexão com o desktop: continua com as últimas cores recebidas.
      } finally {
        syncing = false;
      }
    }

    syncDesktopColors();
    const interval = setInterval(syncDesktopColors, DESKTOP_SYNC_INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncDesktopColors();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [ready, themeId]);

  const value = useMemo(() => {
    const followDesktop = themeId === "web";
    const background = desktopColors?.background ?? WEB_DEFAULT_COLORS.background;
    return {
      themeId,
      setThemeId(next) {
        if (!THEMES[next]) return;
        setThemeIdState(next);
        AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
      },
      palette: followDesktop ? buildWebPalette(desktopColors) : DEFAULT_PALETTE,
      statusBarStyle: followDesktop && isLightColor(background) ? "dark-content" : "light-content",
    };
  }, [themeId, desktopColors]);

  if (!ready) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Para cores usadas fora de um StyleSheet: color={themeColor("#7c5cff")}.
export function useThemeColor() {
  const { palette } = useTheme();
  return useMemo(() => (color) => translateColor(color, palette), [palette]);
}

// Substitui StyleSheet.create: devolve um hook com os estilos do tema ativo.
export function createThemedStyles(definition) {
  let styles;
  let stylesPalette;
  return function useThemedStyles() {
    const { palette } = useTheme();
    if (stylesPalette !== palette) {
      styles = StyleSheet.create(translateStyles(definition, palette));
      stylesPalette = palette;
    }
    return styles;
  };
}
