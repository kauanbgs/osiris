// verificacaoGoogle.js — confere no próprio Google se o token de login (ID token) é verdadeiro e foi feito para o Osíris.
// Só aceita e-mail verificado e token emitido para o GOOGLE_CLIENT_ID configurado no servidor.
const { AppError, UnauthorizedError, BadRequestError } = require("../errors");

const ENDERECO_VERIFICACAO = "https://oauth2.googleapis.com/tokeninfo";
const EMISSORES_VALIDOS = new Set(["accounts.google.com", "https://accounts.google.com"]);

async function verificarTokenGoogle(credencial) {
  const idsPermitidos = String(process.env.GOOGLE_CLIENT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!idsPermitidos.length) {
    throw new AppError("O login com Google não está configurado no servidor.", 503);
  }
  if (typeof credencial !== "string" || !credencial.trim()) {
    throw new BadRequestError("Token do Google não informado.");
  }

  let resposta;
  try {
    resposta = await fetch(`${ENDERECO_VERIFICACAO}?id_token=${encodeURIComponent(credencial)}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError("Não foi possível falar com o Google para validar o login.", 503);
  }
  // O Google responde erro quando a assinatura é falsa ou o token expirou.
  if (!resposta.ok) throw new UnauthorizedError("Login com Google inválido ou expirado.");

  const dados = await resposta.json();
  const emailVerificado = dados.email_verified === true || dados.email_verified === "true";
  if (!idsPermitidos.includes(dados.aud) || !EMISSORES_VALIDOS.has(dados.iss) || !dados.email || !emailVerificado) {
    throw new UnauthorizedError("Login com Google inválido ou expirado.");
  }

  return {
    email: String(dados.email).trim().toLowerCase(),
    name: dados.name || dados.given_name || String(dados.email).split("@")[0],
  };
}

module.exports = { verificarTokenGoogle };
