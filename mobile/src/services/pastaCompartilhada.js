// pastaCompartilhada.js — lê, salva e apaga arquivos da pasta que o app desktop compartilhou com o celular.
// Usa a rede local (porta 8080) quando alcança o PC; senão, a API repassa o pedido ao desktop da mesma conta.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { pelaApi, requisitarDesktop, rotaAtualDesktop } from "./desktopModels";

// Tenta a rede local e, se o PC não estiver nela, faz o mesmo pedido pela API.
async function pedirAoDesktop(caminhoLocal, opcoesLocais, chamadaApi) {
  if (rotaAtualDesktop() === "api") return pelaApi(chamadaApi);
  const token = await AsyncStorage.getItem("token");
  try {
    return await requisitarDesktop(caminhoLocal, { ...opcoesLocais, token });
  } catch (error) {
    if (!error.semConexao && !error.demorou) throw error;
    return pelaApi(chamadaApi);
  }
}

const consulta = (caminhoRelativo) => `path=${encodeURIComponent(caminhoRelativo)}`;

// Devolve { folderName, files } ou null quando nenhuma pasta foi compartilhada.
export async function buscarPastaCompartilhada() {
  const dados = await pedirAoDesktop("/api/pasta-compartilhada", {}, () => api.get("/file/workspace"));
  return dados?.workspace || null;
}

export async function lerArquivoCompartilhado(caminhoRelativo) {
  const dados = await pedirAoDesktop(
    `/api/pasta-compartilhada/arquivo?${consulta(caminhoRelativo)}`,
    {},
    () => api.get("/file/workspace/content", { params: { path: caminhoRelativo } }),
  );
  return dados?.fileContent ?? "";
}

export function salvarArquivoCompartilhado(caminhoRelativo, conteudo) {
  return pedirAoDesktop(
    "/api/pasta-compartilhada/arquivo",
    { method: "PUT", body: { path: caminhoRelativo, content: conteudo } },
    () => api.put("/file/workspace/content", { path: caminhoRelativo, content: conteudo }),
  );
}

export function apagarArquivoCompartilhado(caminhoRelativo) {
  return pedirAoDesktop(
    `/api/pasta-compartilhada/arquivo?${consulta(caminhoRelativo)}`,
    { method: "DELETE" },
    () => api.delete("/file/workspace/item", { params: { path: caminhoRelativo } }),
  );
}
