// browserProxyService.js — busca páginas externas para o Navegador do modo web e remove os bloqueios de iframe.
// Confere o destino (inclusive o DNS e cada redirecionamento) para não alcançar a rede interna do servidor.
const { BadRequestError, ForbiddenError } = require("../errors");
const { assertPublicDestination } = require("./browserCaptureService");

const MAX_REDIRECIONAMENTOS = 5;
const MAX_BYTES_RESPOSTA = 10 * 1024 * 1024;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

function isBlockedHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "::1") return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^(fc|fd|fe80)/.test(h) && h.includes(":")) return true;
  return false;
}

function injectedScript(finalUrl) {
  return `<script>(function(){
  var BASE=${JSON.stringify(finalUrl)};
  function send(type,data){try{parent.postMessage(Object.assign({__osiris:type},data),"*")}catch(e){}}
  function abs(u){try{return new URL(u,document.baseURI).href}catch(e){return null}}
  document.addEventListener("click",function(e){
    if(e.defaultPrevented||e.button!==0)return;
    var a=e.target&&e.target.closest&&e.target.closest("a[href]");
    if(!a)return;
    var raw=a.getAttribute("href")||"";
    if(!raw||raw.charAt(0)==="#"||/^(javascript|mailto|tel|data|blob):/i.test(raw))return;
    var u=abs(raw);
    if(!u||!/^https?:/i.test(u))return;
    var here=new URL(BASE);var dest=new URL(u);
    if(dest.origin===here.origin&&dest.pathname===here.pathname&&dest.search===here.search&&dest.hash)return;
    e.preventDefault();send("navigate",{url:u});
  },true);
  document.addEventListener("submit",function(e){
    var f=e.target;if(!f||f.tagName!=="FORM")return;
    if((f.getAttribute("method")||"get").toLowerCase()!=="get")return;
    var action=abs(f.getAttribute("action")||BASE);if(!action)return;
    var u=new URL(action);var fd=new FormData(f);
    if(e.submitter&&e.submitter.name)fd.append(e.submitter.name,e.submitter.value||"");
    u.search=new URLSearchParams(fd).toString();
    e.preventDefault();send("navigate",{url:u.href});
  },true);
  window.open=function(u){var x=abs(u);if(x)send("navigate",{url:x});return null};
  function loaded(){send("loaded",{url:BASE,title:document.title})}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",loaded);else loaded();
})();</script>`;
}

function rewriteHtml(html, finalUrl) {
  const head = `<base href="${finalUrl.replace(/"/g, "&quot;")}">${injectedScript(finalUrl)}`;
  let out = html
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "")
    .replace(/<meta[^>]+http-equiv=["']?x-frame-options["']?[^>]*>/gi, "")
    .replace(/<base\s[^>]*>/gi, "");
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}${head}`);
  } else {
    out = head + out;
  }
  return out;
}

function decodeBody(buffer, contentType) {
  const match = /charset=([^;]+)/i.exec(contentType || "");
  const charset = match ? match[1].trim().replace(/["']/g, "") : "utf-8";
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

class BrowserProxyService {
  static isBlockedHost(hostname) {
    return isBlockedHost(hostname);
  }

  static rewriteHtml(html, finalUrl) {
    return rewriteHtml(html, finalUrl);
  }

  // Busca uma página pública conferindo o destino (inclusive o DNS e cada redirecionamento).
  // Usada pelo proxy do modo web e pela leitura de elementos da página no Navegador.
  static async buscarPaginaPublica(rawTarget, { accept, acceptLanguage } = {}) {
    let target;
    try {
      target = new URL(rawTarget);
    } catch {
      throw new BadRequestError("URL inválida.");
    }

    if (!/^https?:$/.test(target.protocol)) {
      throw new BadRequestError("Apenas protocolos http e https são suportados.");
    }

    if (isBlockedHost(target.hostname)) {
      throw new ForbiddenError("Endereços locais não podem ser abertos pelo proxy.");
    }

    // Os redirecionamentos são seguidos à mão para conferir cada destino antes de abrir.
    let upstream;
    let atual = target;
    for (let salto = 0; ; salto++) {
      await assertPublicDestination(atual.href);
      try {
        upstream = await fetch(atual.href, {
          redirect: "manual",
          headers: {
            "user-agent": USER_AGENT,
            accept: accept || "text/html,application/xhtml+xml,*/*;q=0.8",
            "accept-language": acceptLanguage || "pt-BR,pt;q=0.9,en;q=0.8",
          },
          signal: AbortSignal.timeout(20000),
        });
      } catch (err) {
        throw new BadRequestError(`Falha ao conectar em ${atual.hostname}: ${err.message}`);
      }

      const destino = upstream.status >= 300 && upstream.status < 400 && upstream.headers.get("location");
      if (!destino) break;
      if (salto >= MAX_REDIRECIONAMENTOS) {
        throw new BadRequestError("A página redirecionou vezes demais.");
      }
      try {
        atual = new URL(destino, atual);
      } catch {
        throw new BadRequestError("A página redirecionou para um endereço inválido.");
      }
      if (!/^https?:$/.test(atual.protocol) || isBlockedHost(atual.hostname)) {
        throw new ForbiddenError("Endereços locais não podem ser abertos pelo proxy.");
      }
    }

    const tamanho = Number(upstream.headers.get("content-length") || 0);
    if (tamanho > MAX_BYTES_RESPOSTA) {
      throw new BadRequestError("A página é grande demais para o proxy.");
    }

    const contentType = upstream.headers.get("content-type") || "";
    const buffer = new Uint8Array(await upstream.arrayBuffer());
    if (buffer.length > MAX_BYTES_RESPOSTA) {
      throw new BadRequestError("A página é grande demais para o proxy.");
    }

    return { status: upstream.status, urlFinal: atual.href, contentType, buffer };
  }

  static decodificar(buffer, contentType) {
    return decodeBody(buffer, contentType);
  }

  static async handleProxy(req, res, rawTarget) {
    const { status, urlFinal, contentType, buffer } = await BrowserProxyService.buscarPaginaPublica(rawTarget, {
      accept: req.headers.accept,
      acceptLanguage: req.headers["accept-language"],
    });

    res.status(status);
    res.setHeader("Cache-Control", "no-store");
    // O endereço do proxy leva o ticket de acesso: não deixa ele vazar para os sites abertos.
    res.setHeader("Referrer-Policy", "no-referrer");
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");

    if (/text\/html|application\/xhtml/i.test(contentType)) {
      const html = rewriteHtml(decodeBody(buffer, contentType), urlFinal);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    }

    if (contentType) res.setHeader("Content-Type", contentType);
    return res.send(Buffer.from(buffer));
  }
}

module.exports = BrowserProxyService;
