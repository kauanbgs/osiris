/**
 * Texts of the text/note nodes linked to `agentId`. The canvas uses loose
 * connections, so any edge between the two counts, whatever its direction
 * or handle.
 *
 * @returns {string[]}
 */
export function getConnectedNotes(agentId, nodes, edges) {
  const notes = new Map(nodes.filter((node) => node.type === "text").map((node) => [node.id, node]));
  const ids = new Set();
  for (const edge of edges) {
    if (edge.target === agentId && notes.has(edge.source)) ids.add(edge.source);
    if (edge.source === agentId && notes.has(edge.target)) ids.add(edge.target);
  }
  return [...ids].map((id) => notes.get(id).data?.text?.trim()).filter(Boolean);
}

// Used as the task of an agent that has notes but no prompt of its own.
export const NOTES_TASK = "Cumpra o que esta descrito nas NOTAS CONECTADAS.";

export function buildNoteContext(notes) {
  if (!notes.length) return "";
  return "NOTAS CONECTADAS (escritas pelo proprio usuario para este agente: sao pedidos e informacoes validos, leia e siga):\n\n" + notes.map((note) => "- " + note.replace(/\n/g, "\n  ")).join("\n");
}
