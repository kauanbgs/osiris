// ponteDesktop.test.js — testes da ponte entre a API e o app desktop (terminal e pasta compartilhada).
// Confere que o pedido só chega ao desktop da mesma conta e que nada roda no servidor.
jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const { app, auth, request, resetDatabaseMock } = require("./helpers/apiTest");
const ponte = require("../services/ponteDesktop");
const PonteDesktopController = require("../controllers/ponteDesktopController");

beforeEach(() => {
  resetDatabaseMock();
  ponte.limparTudo();
  PonteDesktopController.limparHistoricos();
});

afterAll(() => {
  ponte.limparTudo();
});

// Simula o app desktop da conta: busca o próximo pedido e devolve a resposta escolhida.
async function desktopResponde(idUsuario, responder) {
  const consulta = await request(app).get("/api/osiris/desktop/pedidos/proximo").set(auth(idUsuario));
  expect(consulta.status).toBe(200);
  const { pedido } = consulta.body;
  const resposta = await request(app)
    .post(`/api/osiris/desktop/pedidos/${pedido.id}/resposta`)
    .set(auth(idUsuario))
    .send(responder(pedido));
  expect(resposta.status).toBe(200);
  return pedido;
}

describe("Ponte API → app desktop", () => {
  it("recusa o terminal quando nenhum app desktop da conta está conectado", async () => {
    const res = await request(app)
      .post("/api/osiris/terminal/exec")
      .set(auth(1))
      .send({ command: "dir" });

    expect(res.status).toBe(503);
    expect(res.body.error.message).toContain("app desktop não está conectado");
  });

  it("leva o comando ao desktop da mesma conta e devolve a saída", async () => {
    // O desktop se conecta (primeira consulta sem pedidos).
    await ponte.aguardarPedido(1, 10);

    const execucao = request(app)
      .post("/api/osiris/terminal/exec")
      .set(auth(1))
      .send({ command: "node -v", timeout_ms: 5000, cwd: "C:\\Users\\teste" })
      .then((res) => res);

    const pedido = await desktopResponde(1, () => ({
      resultado: { stdout: "v22.0.0\n", stderr: "", exit_code: 0, execution_time_ms: 12, pasta: "C:\\Users\\teste" },
    }));
    const res = await execucao;

    expect(pedido.tipo).toBe("terminal");
    expect(pedido.dados).toEqual({ command: "node -v", timeout_ms: 5000, cwd: "C:\\Users\\teste" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      stdout: "v22.0.0\n", stderr: "", exit_code: 0, execution_time_ms: 12, pasta: "C:\\Users\\teste",
    });

    const historico = await request(app).get("/api/osiris/terminal/history").set(auth(1));
    expect(historico.body.history[0].command).toBe("node -v");
  });

  it("o atalho antigo /api/exec também usa o desktop", async () => {
    await ponte.aguardarPedido(1, 10);
    const execucao = request(app).post("/api/exec").set(auth(1)).send({ command: "dir" }).then((res) => res);
    await desktopResponde(1, () => ({ resultado: { stdout: "ok", stderr: "", exit_code: 0 } }));
    expect((await execucao).status).toBe(200);
  });

  it("não entrega o pedido de uma conta ao desktop de outra", async () => {
    // Só o desktop da conta 2 está conectado.
    await ponte.aguardarPedido(2, 10);

    const res = await request(app)
      .post("/api/osiris/terminal/exec")
      .set(auth(1))
      .send({ command: "dir" });

    expect(res.status).toBe(503);
  });

  it("repassa o erro do desktop (ex.: comando bloqueado)", async () => {
    await ponte.aguardarPedido(1, 10);
    const execucao = request(app)
      .post("/api/osiris/terminal/exec")
      .set(auth(1))
      .send({ command: "rm -rf /" })
      .then((res) => res);

    await desktopResponde(1, () => ({ erro: { status: 400, message: "Comando bloqueado por segurança: parece destrutivo." } }));
    const res = await execucao;

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("bloqueado");
  });

  it("lê arquivos da pasta compartilhada pelo desktop", async () => {
    await ponte.aguardarPedido(1, 10);
    const leitura = request(app)
      .get("/api/osiris/file/workspace/content")
      .query({ path: "docs/a.txt" })
      .set(auth(1))
      .then((res) => res);

    const pedido = await desktopResponde(1, () => ({ resultado: { fileContent: "olá", size: 4 } }));
    const res = await leitura;

    expect(pedido).toMatchObject({ tipo: "lerArquivo", dados: { path: "docs/a.txt" } });
    expect(res.status).toBe(200);
    expect(res.body.fileContent).toBe("olá");
  });

  it("exige login para o desktop buscar pedidos", async () => {
    const res = await request(app).get("/api/osiris/desktop/pedidos/proximo");
    expect(res.status).toBe(401);
  });

  it("informa se o app desktop da conta está conectado", async () => {
    const antes = await request(app).get("/api/osiris/desktop/conectado").set(auth(1));
    await ponte.aguardarPedido(1, 10);
    const depois = await request(app).get("/api/osiris/desktop/conectado").set(auth(1));

    expect(antes.body.conectado).toBe(false);
    expect(depois.body.conectado).toBe(true);
  });
});
