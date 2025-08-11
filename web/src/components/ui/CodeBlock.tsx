import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	oneDark,
	oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { Card } from "./Card";

interface CodeBlockProps {
	language: string;
	code: string;
	filename?: string;
	showLineNumbers?: boolean;
	className?: string;
}

export function CodeBlock({
	language,
	code,
	filename,
	showLineNumbers = true,
	className,
}: CodeBlockProps) {
	const [isCopied, setIsCopied] = useState(false);
	const [isDarkMode] = useState(true); // For now, always use dark mode - can be made dynamic later

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setIsCopied(true);
			setTimeout(() => setIsCopied(false), 2000);
		} catch (error) {
			console.error("Failed to copy code:", error);
		}
	};

	const getLanguageLabel = (lang: string) => {
		const languageMap: Record<string, string> = {
			js: "JavaScript",
			jsx: "JSX",
			ts: "TypeScript",
			tsx: "TSX",
			py: "Python",
			rb: "Ruby",
			php: "PHP",
			java: "Java",
			cpp: "C++",
			c: "C",
			cs: "C#",
			go: "Go",
			rs: "Rust",
			html: "HTML",
			css: "CSS",
			scss: "SCSS",
			json: "JSON",
			xml: "XML",
			yaml: "YAML",
			yml: "YAML",
			md: "Markdown",
			sql: "SQL",
			sh: "Shell",
			bash: "Bash",
			zsh: "Zsh",
			powershell: "PowerShell",
			dockerfile: "Dockerfile",
			text: "Plain Text",
		};

		return languageMap[lang.toLowerCase()] || lang.toUpperCase();
	};

	return (
		<Card className={cn("overflow-hidden", className)}>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
				<div className="flex items-center gap-2">
					{filename && (
						<span className="text-sm font-mono text-muted-foreground">
							{filename}
						</span>
					)}
					<span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
						{getLanguageLabel(language)}
					</span>
				</div>

				<Button
					variant="ghost"
					size="sm"
					onClick={copyToClipboard}
					className="h-6 w-6 p-0"
				>
					{isCopied ? (
						<Check className="h-3 w-3 text-green-600" />
					) : (
						<Copy className="h-3 w-3" />
					)}
				</Button>
			</div>

			{/* Code */}
			<div className="relative overflow-x-auto">
				<SyntaxHighlighter
					language={language}
					style={isDarkMode ? oneDark : oneLight}
					showLineNumbers={showLineNumbers}
					customStyle={{
						margin: 0,
						padding: "1rem",
						background: "transparent",
						fontSize: "0.875rem",
						lineHeight: "1.5",
					}}
					codeTagProps={{
						style: {
							fontFamily:
								'"JetBrains Mono", "Fira Code", "Consolas", monospace',
						},
					}}
				>
					{code}
				</SyntaxHighlighter>
			</div>
		</Card>
	);
}
