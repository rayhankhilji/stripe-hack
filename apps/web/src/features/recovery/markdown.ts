// A deliberately small markdown reader for agent explanations. It supports what the explainer
// prompt produces (paragraphs, headings, bullet/numbered lists, **bold**, *italic*, `code`, [En])
// and nothing that could inject markup: the output is plain data rendered by React.

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "code"; text: string }
  | { type: "cite"; n: number };

export type Block =
  | { type: "heading"; level: 2 | 3 | 4; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

const INLINE = /(\[E(\d+)\])|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*\s][^*]*)\*)|(_([^_\s][^_]*)_)/g;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of src.matchAll(INLINE)) {
    const at = m.index;
    if (at > last) out.push({ type: "text", text: src.slice(last, at) });
    if (m[2] !== undefined) out.push({ type: "cite", n: Number(m[2]) });
    else if (m[4] !== undefined) out.push({ type: "strong", text: m[4] });
    else if (m[6] !== undefined) out.push({ type: "code", text: m[6] });
    else if (m[8] !== undefined) out.push({ type: "em", text: m[8] });
    else if (m[10] !== undefined) out.push({ type: "em", text: m[10] });
    last = at + m[0].length;
  }
  if (last < src.length) out.push({ type: "text", text: src.slice(last) });
  return out;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", content: parseInline(para.join(" ")) });
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    para = [];
    list = null;
  };

  for (const raw of src.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading?.[1] && heading[2] !== undefined) {
      flush();
      const level = Math.min(4, Math.max(2, heading[1].length + 1)) as 2 | 3 | 4;
      blocks.push({ type: "heading", level, content: parseInline(heading[2]) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const item = bullet?.[1] ?? numbered?.[1];
    if (item !== undefined) {
      const ordered = numbered !== null;
      if (para.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push(item);
      continue;
    }
    if (list && /^\s{2,}/.test(raw)) {
      // Indented continuation of the previous list item.
      const i = list.items.length - 1;
      list.items[i] = `${list.items[i] ?? ""} ${line.trim()}`;
      continue;
    }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return blocks;
}
