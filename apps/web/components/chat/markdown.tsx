import Link from "next/link";
import { Fragment } from "react";

/** Minimal, safe markdown: paragraphs, "-"/"1." lists, **bold**, [links](url). No raw HTML. */
function inline(text: string, key: string) {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] && m[2]) {
      const href = m[2];
      const internal = href.startsWith("/") && !href.startsWith("//");
      const safe = internal || /^https?:\/\//.test(href);
      out.push(
        !safe ? (
          m[1]
        ) : internal ? (
          <Link key={`${key}-${i++}`} href={href} scroll={false} className="font-medium text-brand underline underline-offset-2">
            {m[1]}
          </Link>
        ) : (
          <a key={`${key}-${i++}`} href={href} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
            {m[1]}
          </a>
        ),
      );
    } else if (m[3]) out.push(<strong key={`${key}-${i++}`}>{m[3]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l${blocks.length}`} className={list.ordered ? "list-decimal space-y-1.5 pl-5" : "list-disc space-y-1.5 pl-5"}>
        {list.items.map((it, j) => (
          <li key={j}>{inline(it, `li${blocks.length}-${j}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]!);
      return;
    }
    flush();
    if (!line.trim()) return;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(
      <p key={`p${idx}`} className={h ? "font-semibold" : undefined}>
        {inline(h ? h[1]! : line, `p${idx}`)}
      </p>,
    );
  });
  flush();
  return <Fragment>{blocks}</Fragment>;
}
