const colorMap = {
    violeta: {
        fill: "bg-violet-600 text-white hover:bg-violet-500 active:bg-violet-700",
        outline: ""
    },
}

export default function Button({ rounded = "lg", text, icon: Icon, onClick, color = "violeta", type = "submit", className }) {
    const colorClass = colorMap[color]?.fill ?? colorMap.violeta.fill
    return (
        <button
            onClick={onClick}
            type={type}
            className={`${colorClass} w-full flex items-center justify-center gap-2 rounded-${rounded} py-3 font-mono font-semibold transition-colors cursor-pointer ${className}`}
        >
            {Icon && <Icon size={18} />}
            {text}
        </button>
    )
}