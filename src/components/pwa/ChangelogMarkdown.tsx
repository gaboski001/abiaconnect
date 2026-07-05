import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface ChangelogMarkdownProps {
  content: string
  className?: string
  tone?: 'light' | 'dark'
}

/**
 * Safe, styled markdown renderer for release changelogs.
 * Uses GFM (lists, tables, strikethrough, task lists). Links are external and safe.
 */
export function ChangelogMarkdown({ content, className, tone = 'light' }: ChangelogMarkdownProps) {
  const dark = tone === 'dark'
  return (
    <div
      className={cn(
        'text-sm leading-relaxed',
        dark ? 'text-white/85' : 'text-foreground',
        // Prose-like spacing without depending on @tailwindcss/typography
        '[&>*+*]:mt-2',
        '[&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-4',
        '[&_h2]:text-sm [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-widest [&_h2]:mt-4',
        dark ? '[&_h2]:text-[#F8C301]' : '[&_h2]:text-primary',
        '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3',
        '[&_p]:text-sm',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1',
        '[&_li]:text-sm',
        '[&_li>p]:m-0',
        '[&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:font-mono',
        dark
          ? '[&_code]:bg-white/10 [&_code]:text-white'
          : '[&_code]:bg-muted [&_code]:text-foreground',
        '[&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-auto [&_pre]:text-xs',
        dark ? '[&_pre]:bg-white/5' : '[&_pre]:bg-muted',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_a]:underline [&_a]:underline-offset-2',
        dark ? '[&_a]:text-[#F8C301]' : '[&_a]:text-primary',
        '[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic',
        dark ? '[&_blockquote]:border-white/20 [&_blockquote]:text-white/70' : '[&_blockquote]:border-border [&_blockquote]:text-muted-foreground',
        '[&_hr]:my-3 [&_hr]:border-0 [&_hr]:h-px',
        dark ? '[&_hr]:bg-white/10' : '[&_hr]:bg-border',
        '[&_table]:w-full [&_table]:text-xs [&_table]:border-collapse',
        '[&_th]:text-left [&_th]:font-semibold [&_th]:p-2 [&_td]:p-2',
        dark ? '[&_th]:border-white/10 [&_td]:border-white/10' : '[&_th]:border-border [&_td]:border-border',
        '[&_th]:border-b [&_td]:border-b',
        '[&_input[type=checkbox]]:mr-1.5',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default ChangelogMarkdown
