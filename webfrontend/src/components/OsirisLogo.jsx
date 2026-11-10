import logoSource from "@/assets/osiris-logo.svg?raw";

// O SVG original é um estêncil: uma placa retangular com a marca vazada e cor
// fixa por prefers-color-scheme. Aqui removemos a placa (a marca passa a ser o
// preenchimento) e usamos currentColor, então o logo segue a cor do texto/tema.
const PLATE = /d="M0\.0 728\.5L0\.0 0\.0[^Z]*Z\s*/;

const markup = logoSource
  .replace(/<\?xml[^>]*\?>/, "")
  .replace(/<title>[\s\S]*?<\/title>/, "")
  .replace(/<style>[\s\S]*?<\/style>/, "")
  .replace(PLATE, 'd="')
  .replace(/class="logo"/g, 'fill="currentColor"')
  .replace("<svg", '<svg width="100%" height="100%" aria-hidden="true"');

export default function OsirisLogo({ className = "", title = "Osiris" }) {
  return (
    <span
      role="img"
      aria-label={title}
      className={`inline-block aspect-[1023/1457] ${className}`}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

// Marca + nome. "inline" (sidebar): lado a lado; "stacked" (login/cadastro): empilhado.
export function OsirisBrand({
  layout = "inline",
  className = "",
  text = "OSIRIS",
  textClassName = "font-logo font-semibold tracking-wide",
  markClassName,
  textSizeClassName,
}) {
  const stacked = layout === "stacked";

  return (
    <span
      className={`inline-flex items-center ${
        stacked ? "flex-col gap-4" : "gap-2"
      } ${className}`}
    >
      <OsirisLogo className={markClassName ?? (stacked ? "h-24" : "h-7")} />
      <span
        className={`${textClassName} leading-none ${
          textSizeClassName ?? (stacked ? "text-5xl" : "text-2xl")
        }`}
      >
        {text}
      </span>
    </span>
  );
}
