import React from 'react';
import Markdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  return (
    <div className={`markdown-content ${className}`}>
      <Markdown
        components={{
          h1: ({ children }) => (
            <h1 className="font-display font-black text-base sm:text-lg text-[#17231C] mt-3 mb-1.5 tracking-tight flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#174F35] shrink-0" />
              <span>{children}</span>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-display font-bold text-sm sm:text-base text-[#174F35] mt-2.5 mb-1 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-display font-bold text-xs sm:text-sm text-stone-900 mt-2 mb-0.5">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed my-1">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-1.5 pl-4 list-disc text-xs sm:text-sm text-stone-700 space-y-1 marker:text-[#174F35]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 pl-4 list-decimal text-xs sm:text-sm text-stone-700 space-y-1.5 marker:font-bold marker:text-[#174F35]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-1 text-stone-700">
              {children}
            </li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-2xl border border-stone-200 shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#E8F1E9] text-[#174F35] font-bold text-[11px] uppercase tracking-wider border-b border-stone-200">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-stone-100 bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-stone-50/80 transition">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="py-2 px-3 font-extrabold text-[#174F35]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="py-2 px-3 text-stone-800 font-medium">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-[#174F35] bg-[#E8F1E9]/40 pl-3 py-1.5 my-2 rounded-r-xl text-xs text-stone-700 italic">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className="font-extrabold text-[#17231C]">
              {children}
            </strong>
          ),
          code: ({ children }) => (
            <code className="bg-stone-100 text-stone-800 px-1.5 py-0.5 rounded-md text-[11px] font-mono border border-stone-200">
              {children}
            </code>
          )
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};

export default MarkdownRenderer;
