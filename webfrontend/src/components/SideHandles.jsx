import { Handle, Position } from "@xyflow/react";

const SIDES = [
  ["top", Position.Top],
  ["right", Position.Right],
  ["bottom", Position.Bottom],
  ["left", Position.Left],
];

const hidden = { opacity: 0, pointerEvents: "none" };

/**
 * Um ponto de conexao em cada lado do node. Todos sao "source" e o canvas usa
 * ConnectionMode.Loose, entao qualquer ponto liga em qualquer ponto: quem
 * decide entrada ou saida e o sentido em que a linha foi arrastada
 * (de onde saiu -> onde chegou).
 *
 * `legacy` recria, invisiveis, os pontos de versoes antigas para que
 * workflows salvos continuem desenhando suas ligacoes.
 */
export default function SideHandles({ className, legacy = [] }) {
  return (
    <>
      {SIDES.map(([side, position]) => (
        <Handle key={side} id={`side-${side}`} type="source" position={position} className={className} />
      ))}
      {legacy.map(({ id, type, position, top }) => (
        <Handle key={id} id={id} type={type} position={position} isConnectable={false} style={{ ...hidden, ...(top ? { top } : {}) }} />
      ))}
    </>
  );
}
