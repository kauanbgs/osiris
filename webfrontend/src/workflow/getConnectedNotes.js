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

export function buildNoteContext(notes) {
  if (!notes.length) return "";
  return "NOTAS CONECTADAS (anotacoes do usuario no workflow):\n\n" + notes.map((note) => "- " + note.replace(/\n/g, "\n  ")).join("\n");
}
