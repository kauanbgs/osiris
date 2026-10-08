import { Trash2, X } from "lucide-react";
import { useEffect } from "react";

export default function ConfirmDeleteModal({ title, onConfirm, onCancel }) {
  // Fecha com Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      {/* Card */}
      <div
        className="relative w-full max-w-sm rounded-xl border border-zinc-800 bg-[#1a1a1a] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "modalIn 0.18s ease-out both" }}
      >
        {/* Botão fechar */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X size={14} />
        </button>

        {/* Ícone */}
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
          <Trash2 size={18} className="text-red-400" />
        </div>

        {/* Texto */}
        <h2 className="mb-1 text-[15px] font-semibold text-zinc-100">
          Deletar chat
        </h2>
        <p className="mb-5 text-[13px] text-zinc-400">
          Tem certeza que deseja deletar{" "}
          <span className="font-medium text-zinc-200">"{title}"</span>?{" "}
          Esta ação não pode ser desfeita.
        </p>

        {/* Ações */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-[13px] text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-red-500"
          >
            Deletar
          </button>
        </div>
      </div>
    </div>
  );
}
