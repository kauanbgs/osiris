const dns = require("node:dns").promises;
const net = require("node:net");
const { chromium } = require("playwright");
const { BadRequestError } = require("../errors");

const MAX_BYTES = 4 * 1024 * 1024;

// Verifica se um IP é privado ou reservado.
function isPrivateIp(ip) {
  const normalized = ip.toLowerCase();

  if (net.isIP(normalized) === 6) {
    return !/^[23][0-9a-f]{3}:/i.test(normalized);
  }

  if (net.isIP(normalized) !== 4) return true;

  const [a, b, c] = normalized.split(".").map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && c === 0))) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

// Verifica se a URL pode ser utilizada.
function validatePublicUrl(rawUrl) {
  if (
    typeof rawUrl !== "string" ||
    !rawUrl.trim() ||
    rawUrl.length > 2048
  ) {
    throw new BadRequestError("Informe uma URL válida.");
  }

  let parsed;

  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new BadRequestError("URL inválida.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new BadRequestError(
      "Somente HTTP e HTTPS são permitidos."
    );
  }

  if (parsed.username || parsed.password) {
    throw new BadRequestError(
      "URLs com usuário e senha não são permitidas."
    );
  }

  if (parsed.port && !["80", "443"].includes(parsed.port)) {
    throw new BadRequestError(
      "Somente as portas 80 e 443 são permitidas."
    );
  }

  const host = parsed.hostname
    .replace(/^\[|\]$/g, "")
    .toLowerCase();

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".test") ||
    host.endsWith(".invalid") ||
    host.endsWith(".example") ||
    (net.isIP(host) && isPrivateIp(host))
  ) {
    throw new BadRequestError(
      "Endereços locais ou privados não são permitidos."
    );
  }

  return parsed;
}

// Confere o destino da URL usando DNS.
async function assertPublicDestination(rawUrl) {
  const parsed = validatePublicUrl(rawUrl);
  const host = parsed.hostname.replace(/^\[|\]$/g, "");

  if (net.isIP(host)) return;

  let addresses;

  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new BadRequestError(
      "Não foi possível localizar o domínio."
    );
  }

  if (
    !addresses.length ||
    addresses.some(({ address }) => isPrivateIp(address))
  ) {
    throw new BadRequestError(
      "O domínio aponta para um endereço bloqueado."
    );
  }
}

// Abre a página, captura a imagem e extrai os dados.
async function capturePage(rawUrl) {
  const parsed = validatePublicUrl(rawUrl);

  await assertPublicDestination(parsed.href);

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: {
        width: 1280,
        height: 800,
      },
      acceptDownloads: false,
      serviceWorkers: "block",
      javaScriptEnabled: true,
    });

    const page = await context.newPage();

    page.setDefaultTimeout(12000);

    // Bloqueia destinos que não passam na validação.
    await page.route("**/*", async (route) => {
      const requestUrl = route.request().url();

      // Permite recursos locais embutidos em memória (imagens inline, fontes, svg)
      if (
        requestUrl.startsWith("data:") ||
        requestUrl.startsWith("blob:") ||
        requestUrl.startsWith("about:")
      ) {
        return route.continue();
      }

      try {
        await assertPublicDestination(requestUrl);
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });

    // Abre a página com tratamento operacional de timeout e erros de rede.
    let response;
    try {
      response = await page.goto(parsed.href, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
    } catch (navError) {
      if (
        navError.name === "TimeoutError" ||
        navError.message?.includes("Timeout")
      ) {
        throw new BadRequestError(
          "Tempo limite esgotado ao tentar carregar a página."
        );
      }
      throw new BadRequestError(
        `Falha ao conectar à página: ${navError.message || "Erro de conexão"}`
      );
    }

    if (!response) {
      throw new BadRequestError(
        "A página não retornou uma resposta HTTP válida."
      );
    }

    // Proteção contra DNS rebinding: confere o IP efetivamente conectado pelo Chromium.
    try {
      const serverAddr = await response.serverAddr();
      if (serverAddr?.ipAddress) {
        const connectedIp = serverAddr.ipAddress.replace(/^\[|\]$/g, "");
        if (isPrivateIp(connectedIp)) {
          throw new BadRequestError(
            "O endereço de destino resolveu para uma rede privada ou reservada."
          );
        }
      }
    } catch (ipErr) {
      if (ipErr instanceof BadRequestError) {
        throw ipErr;
      }
    }

    if (response.status() >= 400) {
      throw new BadRequestError(
        `A página retornou HTTP ${response.status()}.`
      );
    }

    // Extrai dados estruturados do HTML.
    const data = await page.evaluate(() => {
      const clean = (value) =>
        String(value || "")
          .replace(/\s+/g, " ")
          .trim();

      const text = (element) =>
        clean(
          element?.innerText ||
          element?.textContent
        );

      const headings = [
        ...document.querySelectorAll("h1, h2, h3"),
      ]
        .slice(0, 30)
        .map((element) => ({
          level: element.tagName.toLowerCase(),
          text: text(element),
        }))
        .filter((item) => item.text);

      const links = [
        ...document.querySelectorAll("a[href]"),
      ]
        .slice(0, 80)
        .map((element) => ({
          text: text(element).slice(0, 120),
          url: element.href,
        }))
        .filter(
          (item) =>
            item.text &&
            /^https?:\/\//i.test(item.url)
        )
        .slice(0, 30);

      const tables = [
        ...document.querySelectorAll("table"),
      ]
        .slice(0, 3)
        .map((table) =>
          [...table.querySelectorAll("tr")]
            .slice(0, 10)
            .map((row) =>
              [
                ...row.querySelectorAll("th, td"),
              ]
                .slice(0, 8)
                .map(text)
            )
        );

      return {
        title: clean(document.title),
        description: clean(
          document.querySelector(
            'meta[name="description"]'
          )?.content
        ),
        headings,
        links,
        tables,
        text: clean(
          document.body?.innerText
        ).slice(0, 4000),
        headings_count: headings.length,
        image_count: document.images.length,
      };
    });

    // Decide se captura toda a página.
    const dimensions = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
    }));

    const fullPage = dimensions.height <= 5000;

    // Gera a captura de tela.
    const screenshot = await page.screenshot({
      type: "jpeg",
      quality: 70,
      fullPage,
      animations: "disabled",
      timeout: 15000,
    });

    if (screenshot.length > MAX_BYTES) {
      throw new BadRequestError(
        "A imagem gerada é grande demais."
      );
    }

    // Retorna imagem e dados estruturados.
    return {
      url: page.url(),
      status_code: response.status(),
      captured_at: new Date().toISOString(),
      screenshot: {
        mime_type: "image/jpeg",
        base64: screenshot.toString("base64"),
        full_page: fullPage,
      },
      data,
    };
  } finally {
    // Garante o encerramento do Chromium.
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  capturePage,
  validatePublicUrl,
  isPrivateIp,
  assertPublicDestination,
};
