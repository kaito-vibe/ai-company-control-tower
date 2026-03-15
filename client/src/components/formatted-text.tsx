/**
 * FormattedText: Renders AI-generated text with basic markdown formatting.
 * Handles: headings, bullet/numbered lists, bold, italic, line breaks, code blocks.
 * Does NOT use a full markdown parser — just targeted regex for common AI output patterns.
 */

function formatText(text: string): string {
  // Strip code blocks (JSON) that are technical artifacts
  let cleaned = text.replace(/```json[\s\S]*?```/g, "").replace(/```[\s\S]*?```/g, "");

  // Strip bare JSON arrays/objects that are technical artifacts from AI output
  // Match patterns like [\n  {\n    "key": "value"... }\n] spanning multiple lines
  cleaned = cleaned.replace(/\[\s*\{[\s\S]*?\}\s*\]/g, (match) => {
    // Only strip if it looks like structured data (has quoted keys)
    if (/"\w+"\s*:/.test(match)) return "";
    return match;
  });

  // Escape HTML
  cleaned = cleaned.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Split into lines for block-level formatting
  const lines = cleaned.split("\n");
  const result: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headings: ### Heading, ## Heading, # Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { result.push(listType === "ol" ? "</ol>" : "</ul>"); inList = false; listType = null; }
      const level = headingMatch[1].length;
      const cls = level === 1 ? "text-sm font-bold mt-3 mb-1" : level === 2 ? "text-sm font-semibold mt-2.5 mb-1" : "text-xs font-semibold mt-2 mb-0.5 text-muted-foreground uppercase tracking-wide";
      result.push(`<div class="${cls}">${applyInline(headingMatch[2])}</div>`);
      continue;
    }

    // Bullet list: - item, * item, • item
    const bulletMatch = line.match(/^\s*[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList || listType !== "ul") {
        if (inList) result.push(listType === "ol" ? "</ol>" : "</ul>");
        result.push('<ul class="list-disc list-outside ml-4 space-y-0.5">');
        inList = true; listType = "ul";
      }
      result.push(`<li class="text-sm leading-relaxed">${applyInline(bulletMatch[1])}</li>`);
      continue;
    }

    // Numbered list: 1. item, 2) item
    const numMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (numMatch) {
      if (!inList || listType !== "ol") {
        if (inList) result.push(listType === "ol" ? "</ol>" : "</ul>");
        result.push('<ol class="list-decimal list-outside ml-4 space-y-0.5">');
        inList = true; listType = "ol";
      }
      result.push(`<li class="text-sm leading-relaxed">${applyInline(numMatch[1])}</li>`);
      continue;
    }

    // Empty line — close any open list, add spacing
    if (line.trim() === "") {
      if (inList) { result.push(listType === "ol" ? "</ol>" : "</ul>"); inList = false; listType = null; }
      result.push('<div class="h-2"></div>');
      continue;
    }

    // Regular paragraph
    if (inList) { result.push(listType === "ol" ? "</ol>" : "</ul>"); inList = false; listType = null; }
    result.push(`<p class="text-sm leading-relaxed">${applyInline(line)}</p>`);
  }

  // Close any open list
  if (inList) result.push(listType === "ol" ? "</ol>" : "</ul>");

  return result.join("\n");
}

/** Apply inline formatting: bold, italic, inline code */
function applyInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-muted rounded text-xs font-mono">$1</code>');
}

export function FormattedText({ text, className = "" }: { text: string; className?: string }) {
  const html = formatText(text);
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
