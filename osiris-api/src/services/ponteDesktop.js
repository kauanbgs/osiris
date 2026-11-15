// ponteDesktop.js — leva pedidos (terminal e pasta compartilhada) da API até o app desktop logado na mesma conta.
// O desktop busca os pedidos da sua conta e devolve a resposta; nada é executado no servidor da API.
const crypto = require("crypto");
const { AppError } = require("../errors");

// O desktop pergunta por pedidos a cada ~25 s; sem contato por mais que isso, ele é tido como desconectado.
const ESPERA_POR_PEDIDO_MS = 25 * 1000;
const DESKTOP_DESCONECTADO_APOS_MS = 40 * 1000;
const MAXIMO_PEDIDOS_NA_FILA = 50;

// Estado por usuário: pedidos esperando o desktop, consultas do desktop esperando pedidos e respostas pendentes.
const contas = new Map();

function contaDe(idUsuario) {
  const chave = String(idUsuario);
  if (!contas.has(chave)) {
    contas.set(chave, { fila: [], esperas: [], pendentes: new Map(), ultimoContato: 0 });
  }
  return contas.get(chave);
}

function desktopConectado(idUsuario) {
  return Date.now() - contaDe(idUsuario).ultimoContato < DESKTOP_DESCONECTADO_APOS_MS;
}

// Entrega um pedido ao desktop da conta e espera a resposta.
function enviarParaDesktop(idUsuario, tipo, dados, tempoLimiteMs) {
  const conta = contaDe(idUsuario);
  if (!desktopConectado(idUsuario)) {
    return Promise.reject(new AppError(
      "O app desktop não está conectado nesta conta. Abra o Osíris no PC e entre com a mesma conta.",
      503,
    ));
  }
  if (conta.fila.length >= MAXIMO_PEDIDOS_NA_FILA) {
    return Promise.reject(new AppError("Muitos pedidos aguardando o desktop. Tente de novo em instantes.", 429));
  }

  const pedido = { id: crypto.randomUUID(), tipo, dados };
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(() => {
      conta.pendentes.delete(pedido.id);
      conta.fila = conta.fila.filter((item) => item.id !== pedido.id);
      reject(new AppError("O app desktop não respondeu a tempo.", 504));
    }, tempoLimiteMs);

    conta.pendentes.set(pedido.id, { resolve, reject, temporizador });

    const espera = conta.esperas.shift();
    if (espera) espera(pedido);
    else conta.fila.push(pedido);
  });
}

// Chamado pelo desktop: devolve o próximo pedido da conta ou null depois de esperar um pouco.
// `sinal` avisa quando a conexão do desktop caiu, para o pedido não se perder numa conexão fechada.
function aguardarPedido(idUsuario, esperaMs = ESPERA_POR_PEDIDO_MS, sinal = null) {
  const conta = contaDe(idUsuario);
  conta.ultimoContato = Date.now();
  const proximo = conta.fila.shift();
  if (proximo) return Promise.resolve(proximo);

  return new Promise((resolve) => {
    const encerrar = () => {
      clearTimeout(temporizador);
      conta.esperas = conta.esperas.filter((item) => item !== entregar);
      conta.ultimoContato = Date.now();
    };
    const entregar = (pedido) => {
      encerrar();
      // A conexão caiu bem agora: o pedido volta para a fila, para a próxima consulta.
      if (sinal?.aborted) {
        conta.fila.unshift(pedido);
        resolve(null);
        return;
      }
      resolve(pedido);
    };
    const temporizador = setTimeout(() => {
      encerrar();
      resolve(null);
    }, esperaMs);
    conta.esperas.push(entregar);
    sinal?.addEventListener("abort", () => {
      encerrar();
      resolve(null);
    }, { once: true });
  });
}

// Chamado pelo desktop com a resposta: { resultado } ou { erro: { status, message } }.
function responderPedido(idUsuario, idPedido, resposta) {
  const conta = contaDe(idUsuario);
  conta.ultimoContato = Date.now();
  const pendente = conta.pendentes.get(idPedido);
  if (!pendente) return false;
  conta.pendentes.delete(idPedido);
  clearTimeout(pendente.temporizador);

  if (resposta?.erro) {
    const status = Number.isInteger(resposta.erro.status) ? resposta.erro.status : 500;
    pendente.reject(new AppError(String(resposta.erro.message || "Erro no app desktop."), status));
  } else {
    pendente.resolve(resposta?.resultado ?? null);
  }
  return true;
}

// Usado só pelos testes.
function limparTudo() {
  for (const conta of contas.values()) {
    for (const pendente of conta.pendentes.values()) clearTimeout(pendente.temporizador);
  }
  contas.clear();
}

module.exports = {
  enviarParaDesktop,
  aguardarPedido,
  responderPedido,
  desktopConectado,
  limparTudo,
};
