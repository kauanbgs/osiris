/**
 * Proxy local usado pelo Navegador no modo web.
 *
 * Sites como Google e GitHub enviam `X-Frame-Options` / `Content-Security-Policy:
 * frame-ancestors`, o que faz o <iframe> ficar em branco. Este middleware busca a
 * página no servidor, descarta esses cabeçalhos e injeta um pequeno script que
 * encaminha cliques em links e envios de formulário (GET) de volta para o app,
 * para que a navegação continue passando pelo proxy.
 */

const PROXY_PATH = "/__osiris_proxy";

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
  // Remove CSP via <meta> e <base> originais (o nosso precisa valer)
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

function errorPage(res, status, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;background:#0b0b0f;color:#e4e4e7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center;max-width:420px"><h3 style="margin:0 0 8px">Não foi possível abrir a página</h3>
<p style="color:#a1a1aa;font-size:13px">${String(message).replace(/[<>&]/g, "")}</p></div></body>`);
}

async function handleProxy(req, res) {
  const params = new URL(req.url, "http://localhost").searchParams;
  const rawTarget = params.get("url");

  let target;
  try {
    target = new URL(rawTarget);
  } catch {
    return errorPage(res, 400, "URL inválida.");
  }
  if (!/^https?:$/.test(target.protocol)) return errorPage(res, 400, "Apenas http/https são suportados.");
  if (isBlockedHost(target.hostname)) return errorPage(res, 403, "Endereços locais não podem ser abertos pelo proxy.");

  let upstream;
  try {
    upstream = await fetch(target.href, {
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        accept: req.headers.accept || "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": req.headers["accept-language"] || "pt-BR,pt;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    return errorPage(res, 502, `Falha ao conectar em ${target.hostname}: ${err.message}`);
  }

  const contentType = upstream.headers.get("content-type") || "";
  const buffer = new Uint8Array(await upstream.arrayBuffer());

  res.statusCode = upstream.status;
  res.setHeader("Cache-Control", "no-store");

  if (/text\/html|application\/xhtml/i.test(contentType)) {
    const html = rewriteHtml(decodeBody(buffer, contentType), upstream.url || target.href);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(html);
  }

  if (contentType) res.setHeader("Content-Type", contentType);
  return res.end(Buffer.from(buffer));
}

export default function osirisBrowserProxy() {
  const middleware = (req, res, next) => {
    if (!req.url?.startsWith(PROXY_PATH)) return next();
    handleProxy(req, res).catch((err) => errorPage(res, 500, err.message));
  };
  return {
    name: "osiris-browser-proxy",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
