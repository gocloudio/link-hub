import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
export const markdownOptions = {
  remarkPlugins: [remarkGfm],
  rehypePlugins: [rehypeSanitize],
  skipHtml: true,
  disallowedElements: ["img", "input"],
  components: {
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  },
};
export function Markdown({ value }: { value: string }) {
  return (
    <div className="markdown-body">
      {value.trim() ? (
        <ReactMarkdown {...markdownOptions}>{value}</ReactMarkdown>
      ) : (
        <p className="preview-empty">暂无说明</p>
      )}
    </div>
  );
}
