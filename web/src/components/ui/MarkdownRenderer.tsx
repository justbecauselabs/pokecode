import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface MarkdownRendererProps {
	content: string;
	className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
	return (
		<div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
				code({ node, inline, className, children, ...props }) {
					const match = /language-(\w+)/.exec(className || "");
					const language = match ? match[1] : "text";
					
					if (!inline && match) {
						return (
							<CodeBlock
								language={language}
								code={String(children).replace(/\n$/, "")}
								showLineNumbers={false}
							/>
						);
					}
					
					return (
						<code className="px-1 py-0.5 rounded bg-muted text-sm font-mono" {...props}>
							{children}
						</code>
					);
				},
				pre({ children }) {
					return <>{children}</>;
				},
				p({ children }) {
					return <p className="mb-2 last:mb-0">{children}</p>;
				},
				ul({ children }) {
					return <ul className="list-disc pl-4 mb-2">{children}</ul>;
				},
				ol({ children }) {
					return <ol className="list-decimal pl-4 mb-2">{children}</ol>;
				},
				li({ children }) {
					return <li className="mb-1">{children}</li>;
				},
				h1({ children }) {
					return <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h1>;
				},
				h2({ children }) {
					return <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>;
				},
				h3({ children }) {
					return <h3 className="text-base font-bold mb-2 mt-2 first:mt-0">{children}</h3>;
				},
				blockquote({ children }) {
					return (
						<blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic my-2">
							{children}
						</blockquote>
					);
				},
				a({ href, children }) {
					return (
						<a
							href={href}
							className="text-blue-500 hover:text-blue-600 underline"
							target="_blank"
							rel="noopener noreferrer"
						>
							{children}
						</a>
					);
				},
				table({ children }) {
					return (
						<div className="overflow-x-auto my-2">
							<table className="min-w-full border-collapse border border-muted">
								{children}
							</table>
						</div>
					);
				},
				thead({ children }) {
					return <thead className="bg-muted/50">{children}</thead>;
				},
				tbody({ children }) {
					return <tbody>{children}</tbody>;
				},
				tr({ children }) {
					return <tr className="border-b border-muted">{children}</tr>;
				},
				th({ children }) {
					return (
						<th className="px-2 py-1 text-left font-medium border-r border-muted last:border-r-0">
							{children}
						</th>
					);
				},
				td({ children }) {
					return (
						<td className="px-2 py-1 border-r border-muted last:border-r-0">
							{children}
						</td>
					);
				},
				hr() {
					return <hr className="my-4 border-muted" />;
				},
			}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}