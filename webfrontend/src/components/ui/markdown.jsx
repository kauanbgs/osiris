import { cn } from "@/lib/utils"
import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { CodeBlock, CodeBlockCode } from "./code-block"

function extractLanguage(className) {
  if (!className) return "code"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "code"
}

const CUSTOM_COMPONENTS = {
  h1: ({ children, ...props }) => (
    <h1 className="mt-4 mb-2 text-lg font-semibold text-zinc-100 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-3.5 mb-1.5 text-base font-semibold text-zinc-100 first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-3 mb-1 text-sm font-semibold text-zinc-200 first:mt-0" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-2.5 text-sm text-zinc-200 leading-relaxed last:mb-0" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-3 pl-4 list-disc space-y-1 text-sm text-zinc-200" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-3 pl-4 list-decimal space-y-1 text-sm text-zinc-200" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm text-zinc-200 leading-relaxed" {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="my-2.5 border-l-2 border-violet-500/70 pl-3 py-1 text-sm text-zinc-300 italic bg-violet-500/5 rounded-r-md" {...props}>
      {children}
    </blockquote>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-violet-400 underline decoration-violet-500/40 underline-offset-2 hover:text-violet-300 transition-colors font-medium"
      {...props}>
      {children}
    </a>
  ),
  table: ({ children, ...props }) => (
    <div className="my-3 w-full overflow-x-auto rounded-lg border border-zinc-800 bg-[#121118]">
      <table className="w-full text-left text-sm text-zinc-200 border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-zinc-900/90 text-xs text-zinc-400 uppercase font-mono border-b border-zinc-800" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className="px-4 py-2 font-medium" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-4 py-2 border-b border-zinc-800/40" {...props}>
      {children}
    </td>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-zinc-100" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-zinc-200" {...props}>
      {children}
    </em>
  ),
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <code
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-xs bg-zinc-800/80 text-violet-300 border border-zinc-700/40",
            className
          )}
          {...props}>
          {children}
        </code>
      );
    }

    const language = extractLanguage(className)
    const rawCode = Array.isArray(children)
      ? children.join("")
      : String(children ?? "").replace(/\n$/, "")

    return (
      <CodeBlock className={className} code={rawCode} language={language}>
        <CodeBlockCode code={rawCode} language={language} />
      </CodeBlock>
    );
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
}

function MarkdownComponent({
  children,
  className,
  components = CUSTOM_COMPONENTS,
}) {
  const content = typeof children === "string" ? children : String(children ?? "")

  return (
    <div className={cn("text-sm text-zinc-100 leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
