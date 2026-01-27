import React, { createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

// Context to track if code is inside pre (block code) or inline
const PreContext = createContext<boolean>(false);

// GitHub-style anchor link for headings
function HeadingAnchor({ id }: { id: string }) {
  return (
    <a
      href={`#${id}`}
      className="anchor-link opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-[var(--vscode-textLink-foreground)] no-underline"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 16 16"
        version="1.1"
        width="16"
        height="16"
        aria-hidden="true"
        className="inline-block align-middle"
      >
        <path
          fill="currentColor"
          d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"
        />
      </svg>
    </a>
  );
}

// Generate heading ID from text
function generateHeadingId(children: React.ReactNode): string {
  const text = React.Children.toArray(children)
    .map(child => {
      if (typeof child === 'string') return child;
      if (typeof child === 'number') return String(child);
      return '';
    })
    .join('');

  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const components: Components = {
    // Headings with anchor links
    h1({ children, ...props }) {
      const id = generateHeadingId(children);
      return (
        <h1
          id={id}
          className="group font-semibold leading-tight"
          {...props}
        >
          {children}
          <HeadingAnchor id={id} />
        </h1>
      );
    },
    h2({ children, ...props }) {
      const id = generateHeadingId(children);
      return (
        <h2
          id={id}
          className="group font-semibold leading-tight"
          {...props}
        >
          {children}
          <HeadingAnchor id={id} />
        </h2>
      );
    },
    h3({ children, ...props }) {
      const id = generateHeadingId(children);
      return (
        <h3
          id={id}
          className="group font-semibold leading-tight"
          {...props}
        >
          {children}
          <HeadingAnchor id={id} />
        </h3>
      );
    },
    h4({ children, ...props }) {
      const id = generateHeadingId(children);
      return (
        <h4
          id={id}
          className="group font-semibold leading-tight"
          {...props}
        >
          {children}
          <HeadingAnchor id={id} />
        </h4>
      );
    },
    h5({ children, ...props }) {
      const id = generateHeadingId(children);
      return (
        <h5
          id={id}
          className="group font-semibold leading-tight"
          {...props}
        >
          {children}
          <HeadingAnchor id={id} />
        </h5>
      );
    },
    h6({ children, ...props }) {
      const id = generateHeadingId(children);
      return (
        <h6
          id={id}
          className="group font-semibold leading-tight"
          {...props}
        >
          {children}
          <HeadingAnchor id={id} />
        </h6>
      );
    },

    // Paragraphs
    p({ children, ...props }) {
      return (
        <p className="mb-4 leading-6" {...props}>
          {children}
        </p>
      );
    },

    // Links - GitHub style
    a({ children, href, ...props }) {
      const isExternal = href?.startsWith('http');
      return (
        <a
          href={href}
          className="hover:underline"
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          {...props}
        >
          {children}
          {isExternal && (
            <svg
              className="inline-block ml-1 align-text-top"
              viewBox="0 0 12 12"
              width="12"
              height="12"
              fill="currentColor"
            >
              <path d="M3.5 3a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5V6.5a.5.5 0 0 1 1 0v2a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 2 8.5v-5A1.5 1.5 0 0 1 3.5 2h2a.5.5 0 0 1 0 1h-2Z" />
              <path d="M7.5 2a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h1.5v1.5a.5.5 0 0 0 .5.5h.5a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5h-2Z" />
              <path d="M6.5 5.5a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h.5a.5.5 0 0 0 .5-.5V6a.5.5 0 0 0-.5-.5h-.5Z" />
            </svg>
          )}
        </a>
      );
    },

    // Lists
    ul({ children, ...props }) {
      return (
        <ul className="list-disc pl-6 mb-4 leading-6" {...props}>
          {children}
        </ul>
      );
    },
    ol({ children, ...props }) {
      return (
        <ol className="list-decimal pl-6 mb-4 leading-6" {...props}>
          {children}
        </ol>
      );
    },
    li({ children, ...props }) {
      return (
        <li className="mb-1" {...props}>
          {children}
        </li>
      );
    },

    // Task lists
    input({ type, checked, ...props }) {
      if (type === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={checked}
            disabled
            className="mr-2 align-middle cursor-default"
            {...props}
          />
        );
      }
      return <input type={type} {...props} />;
    },

    // Blockquotes - GitHub style with left border
    blockquote({ children, ...props }) {
      return (
        <blockquote
          className="pl-4 pr-4 py-2 my-4"
          {...props}
        >
          <div className="[&>p]:mb-0 [&>p]:last:mb-0">{children}</div>
        </blockquote>
      );
    },

    // Tables - GitHub style
    table({ children, ...props }) {
      return (
        <div className="overflow-x-auto my-4">
          <table
            className="min-w-full border-collapse border text-sm"
            {...props}
          >
            {children}
          </table>
        </div>
      );
    },
    thead({ children, ...props }) {
      return (
        <thead {...props}>
          {children}
        </thead>
      );
    },
    th({ children, ...props }) {
      return (
        <th
          className="border px-3 py-2 text-left font-semibold"
          {...props}
        >
          {children}
        </th>
      );
    },
    td({ children, ...props }) {
      return (
        <td
          className="border px-3 py-2"
          {...props}
        >
          {children}
        </td>
      );
    },
    tr({ children, ...props }) {
      return (
        <tr
          className=""
          {...props}
        >
          {children}
        </tr>
      );
    },

    // Horizontal rule
    hr({ ...props }) {
      return (
        <hr
          className="my-6 border-0 border-t"
          {...props}
        />
      );
    },

    // Code blocks and inline code
    code({ className, children, ...props }) {
      const inPre = useContext(PreContext);
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');

      // Block code: inside <pre> or has language class
      if (inPre || match) {
        return <CodeBlock language={match?.[1] || ''} code={codeString} />;
      }

      // Inline code
      return (
        <code
          className="px-1.5 py-0.5 rounded text-[0.85em] font-mono border"
          {...props}
        >
          {children}
        </code>
      );
    },

    // Pre blocks wrap children in PreContext
    pre({ children }) {
      return (
        <PreContext.Provider value={true}>
          {children}
        </PreContext.Provider>
      );
    },

    // Strong and emphasis
    strong({ children, ...props }) {
      return (
        <strong className="font-semibold" {...props}>
          {children}
        </strong>
      );
    },
    em({ children, ...props }) {
      return (
        <em className="italic" {...props}>
          {children}
        </em>
      );
    },

    // Deleted and inserted
    del({ children, ...props }) {
      return (
        <del className="line-through" {...props}>
          {children}
        </del>
      );
    },
    ins({ children, ...props }) {
      return (
        <ins className="no-underline" {...props}>
          {children}
        </ins>
      );
    },

    // Subscript and superscript
    sub({ children, ...props }) {
      return (
        <sub className="text-xs" {...props}>
          {children}
        </sub>
      );
    },
    sup({ children, ...props }) {
      return (
        <sup className="text-xs" {...props}>
          {children}
        </sup>
      );
    },
  };

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
