import { useState } from "react";
import { ImagePlus, Palette, Plus, RotateCcw, Trash2 } from "lucide-react";
import { CSS_TEMPLATE, applyTheme, fileToDataUrl, loadImage, loadTheme, saveImage, saveTheme } from "@/lib/theme";

export default function Configuracoes() {
  const [theme, setTheme] = useState(loadTheme);
  const [name, setName] = useState("");
  const [image, setImage] = useState(loadImage);
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState("");

  function changeImage(src) {
    if (!saveImage(src)) {
      setImageError("Imagem grande demais para guardar. Tente uma menor ou use uma URL.");
      return;
    }
    setImageError("");
    setImage(src);
    applyTheme(theme, src);
  }

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      changeImage(await fileToDataUrl(file));
    } catch (error) {
      setImageError(error.message);
    }
  }

  function update(next) {
    setTheme(next);
    saveTheme(next);
    applyTheme(next, image);
  }

  function saveAsTheme() {
    const title = name.trim();
    if (!title || !theme.css.trim()) return;
    update({ ...theme, themes: [...theme.themes, { id: "t-" + Date.now(), name: title, css: theme.css }] });
    setName("");
  }

  return (
    <div className="h-full overflow-y-auto p-8 text-foreground">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <Palette className="text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Aparência</h1>
            <p className="text-sm text-muted-foreground">
              Escreva seu próprio CSS. Ele é aplicado em todo o sistema na hora e fica salvo neste computador.
            </p>
          </div>
        </header>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Imagem de fundo</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 cursor-pointer items-center gap-1 rounded-md bg-primary px-3 text-sm text-primary-foreground">
              <ImagePlus size={15} /> Escolher imagem
              <input type="file" accept="image/*" className="hidden" onChange={pickFile} />
            </label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="ou cole uma URL https://..."
              onKeyDown={(e) => { if (e.key === "Enter" && imageUrl.trim()) { changeImage(imageUrl.trim()); setImageUrl(""); } }}
              className="h-9 min-w-48 flex-1 rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary select-text" />
            {image && (
              <button type="button" onClick={() => changeImage("")}
                className="flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground">
                <Trash2 size={14} /> Remover
              </button>
            )}
          </div>
          {imageError && <p className="text-xs text-destructive">{imageError}</p>}
          {image && <div className="h-24 w-full rounded-md border border-border bg-cover bg-center" style={{ backgroundImage: `url("${image}")` }} />}
          <p className="text-xs text-muted-foreground">
            A imagem aparece atrás de tudo; para ver através das telas, use um CSS com superfícies translúcidas (ex.: o tema Glass).
            No CSS ela está em <code>var(--osiris-bg-image)</code>.
          </p>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">CSS</h2>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <button type="button" className="hover:text-foreground"
                onClick={() => update({ ...theme, css: theme.css ? theme.css + "\n\n" + CSS_TEMPLATE : CSS_TEMPLATE })}>
                Inserir variáveis
              </button>
              <button type="button" className="flex items-center gap-1 hover:text-foreground"
                onClick={() => update({ ...theme, css: "" })}>
                <RotateCcw size={13} /> Restaurar padrão
              </button>
            </div>
          </div>
          <textarea value={theme.css} spellCheck={false} rows={18}
            onChange={(e) => update({ ...theme, css: e.target.value })}
            placeholder={":root {\n  --primary: #ef4444;\n  --sidebar: #000;\n}\n\n#osiris-sidebar { width: 16rem; }"}
            className="w-full rounded-md border border-border bg-input p-3 font-mono text-xs outline-none focus:border-primary select-text" />
          <p className="text-xs text-muted-foreground">
            Dica: a barra lateral usa <code>--sidebar*</code> e tem o id <code>#osiris-sidebar</code>. Se algo quebrar a tela,
            volte aqui e use "Restaurar padrão".
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Meus temas</h2>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do tema (salva o CSS acima)"
              onKeyDown={(e) => e.key === "Enter" && saveAsTheme()}
              className="h-9 flex-1 rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary" />
            <button type="button" onClick={saveAsTheme}
              className="flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm text-primary-foreground">
              <Plus size={15} /> Salvar tema
            </button>
          </div>
          {theme.themes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum tema salvo ainda.</p>
          ) : (
            <ul className="space-y-1">
              {theme.themes.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                  <span className={t.css === theme.css ? "text-primary" : ""}>{t.name}</span>
                  <span className="flex gap-3">
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => update({ ...theme, css: t.css })}>Aplicar</button>
                    <button type="button" title="Excluir tema" className="text-muted-foreground hover:text-destructive"
                      onClick={() => update({ ...theme, themes: theme.themes.filter((x) => x.id !== t.id) })}>
                      <Trash2 size={15} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
