import { cn, copyToClipboard } from "@/lib/utils"
import React, { useEffect, useState } from "react"
import { codeToHtml } from "shiki"
import { Check, Copy } from "lucide-react"

function CodeBlock({
  children,
  className,
  code,
  language = "code",
  ...props
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!code) return
    const success = await copyToClipboard(code)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      className={cn(
        "not-prose my-3 flex w-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#121118] text-zinc-100 shadow-md",
        className
      )}
      {...props}>
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-4 py-1.5 text-xs text-zinc-400 font-mono select-none">
        <span className="capitalize text-zinc-400 font-medium">{language}</span>
        {code && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                <span className="font-medium text-emerald-400">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copiar código</span>
              </>
            )}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function CodeBlockCode({
  code,
  language = "tsx",
  theme = "github-dark",
  className,
  ...props
}) {
  const [highlightedHtml, setHighlightedHtml] = useState(null)

  useEffect(() => {
    async function highlight() {
      if (!code) {
        setHighlightedHtml("<pre><code></code></pre>")
        return
      }

      try {
        const rawCode = typeof code === "string" ? code : String(code)
        const html = await codeToHtml(rawCode, { lang: language, theme })
        setHighlightedHtml(html)
      } catch (err) {
        try {
          const html = await codeToHtml(String(code), { lang: "txt", theme })
          setHighlightedHtml(html)
        } catch {
          setHighlightedHtml(null)
        }
      }
    }
    highlight()
  }, [code, language, theme])

  const classNames = cn("w-full overflow-x-auto text-[13px] font-mono leading-relaxed [&>pre]:p-4 [&>pre]:bg-transparent!", className)

  return highlightedHtml ? (
    <div
      className={classNames}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      {...props} />
  ) : (
    <div className={classNames} {...props}>
      <pre className="p-4">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CodeBlockGroup({
  children,
  className,
  ...props
}) {
  return (
    <div className={cn("flex items-center justify-between", className)} {...props}>
      {children}
    </div>
  );
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock }
