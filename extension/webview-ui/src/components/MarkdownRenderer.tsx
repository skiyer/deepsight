import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, inline, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            // Code block (fenced or indented). Even if no language is specified.
            if (!inline) {
              return <CodeBlock language={match?.[1] || ''} code={codeString} />;
            }

            // Inline code
            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            );
          },
          // Ensure pre doesn't add extra wrapper
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
