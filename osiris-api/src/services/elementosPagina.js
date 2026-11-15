// elementosPagina.js — lê o HTML de uma página e lista os elementos reais que o Inspetor do Navegador mostra.
// Pega título, títulos (h1–h3), links, botões e campos; não executa os scripts da página.
const MAXIMO_POR_TIPO = 60;

function decodificarEntidades(texto) {
  return texto
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function textoLimpo(html) {
  return decodificarEntidades(String(html || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function atributo(atributos, nome) {
  const encontrado = new RegExp(`\\b${nome}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(atributos);
  return encontrado ? decodificarEntidades(encontrado[1] ?? encontrado[2] ?? encontrado[3] ?? "") : null;
}

// Seletor CSS para achar o elemento: pelo id, pela primeira classe ou pela posição entre os do mesmo tipo.
function montarSeletor(tag, atributos, posicao) {
  const id = atributo(atributos, "id");
  if (id && /^[A-Za-z][\w-]*$/.test(id)) return `${tag}#${id}`;
  const classe = (atributo(atributos, "class") || "").split(/\s+/).find((c) => /^[A-Za-z_][\w-]*$/.test(c));
  if (classe) return `${tag}.${classe}`;
  return `${tag}:nth-of-type(${posicao})`;
}

function extrairElementosDaPagina(html, urlBase) {
  const pagina = String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  const titulo = textoLimpo((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(pagina) || [])[1]) || null;
  const elementos = [];
  const usados = new Set();

  const adicionar = (elemento) => {
    if (usados.has(elemento.selector)) return;
    usados.add(elemento.selector);
    elementos.push({ id: `el-${elementos.length + 1}`, ...elemento });
  };

  const percorrer = (padrao, tag, montar) => {
    let posicao = 0;
    let quantidade = 0;
    for (const encontrado of pagina.matchAll(padrao)) {
      posicao += 1;
      const elemento = montar(encontrado, posicao);
      if (!elemento) continue;
      adicionar({ tag, selector: montarSeletor(tag, encontrado[1] || "", posicao), ...elemento });
      quantidade += 1;
      if (quantidade >= MAXIMO_POR_TIPO) break;
    }
  };

  for (const nivel of ["h1", "h2", "h3"]) {
    percorrer(new RegExp(`<${nivel}\\b([^>]*)>([\\s\\S]*?)<\\/${nivel}>`, "gi"), nivel, (m) => {
      const texto = textoLimpo(m[2]);
      return texto ? { text: texto, clickable: false, type: "heading" } : null;
    });
  }

  percorrer(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, "a", (m) => {
    const href = atributo(m[1], "href");
    if (!href || href.startsWith("#") || /^(javascript|mailto|tel|data):/i.test(href)) return null;
    let absoluto;
    try {
      absoluto = new URL(href, urlBase).href;
    } catch {
      return null;
    }
    return { text: textoLimpo(m[2]) || absoluto, clickable: true, type: "link", href: absoluto };
  });

  percorrer(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, "button", (m) => ({
    text: textoLimpo(m[2]) || atributo(m[1], "aria-label") || "Botão",
    clickable: true,
    type: "button",
    disabled: /\bdisabled\b/i.test(m[1]),
  }));

  percorrer(/<input\b([^>]*)>/gi, "input", (m) => {
    const tipo = (atributo(m[1], "type") || "text").toLowerCase();
    if (tipo === "hidden") return null;
    return {
      text: atributo(m[1], "value") || "",
      placeholder: atributo(m[1], "placeholder") || atributo(m[1], "name") || "",
      clickable: true,
      type: "input",
      disabled: /\bdisabled\b/i.test(m[1]),
    };
  });

  return { title: titulo, elements: elementos };
}

module.exports = { extrairElementosDaPagina };
