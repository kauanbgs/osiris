// Valores visuais compartilhados por todas as telas.

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
