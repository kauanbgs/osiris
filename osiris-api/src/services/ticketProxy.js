// ticketProxy.js — gera e confere o ticket de uso restrito que libera o proxy do Navegador do modo web.
// O iframe não envia cabeçalhos, então o ticket vai na URL; por isso ele só vale para o proxy e expira em 12 horas.
const jwt = require("jsonwebtoken");
const { UnauthorizedError } = require("../errors");

const ESCOPO_PROXY = "proxy-navegador";
const VALIDADE_TICKET = "12h";

function gerarTicketProxy(idUsuario) {
  return jwt.sign({ escopo: ESCOPO_PROXY }, process.env.JWT_SECRET, {
    subject: String(idUsuario),
    expiresIn: VALIDADE_TICKET,
  });
}

function validarTicketProxy(ticket) {
  if (typeof ticket !== "string" || !ticket) {
    throw new UnauthorizedError("Faça login para usar o navegador.");
  }
  try {
    const conteudo = jwt.verify(ticket, process.env.JWT_SECRET);
    if (conteudo.escopo !== ESCOPO_PROXY) throw new Error("escopo");
    return conteudo.sub;
  } catch {
    throw new UnauthorizedError("Acesso ao navegador expirado. Recarregue a página.");
  }
}

module.exports = { ESCOPO_PROXY, gerarTicketProxy, validarTicketProxy };
