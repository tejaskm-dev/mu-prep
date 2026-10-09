import { Fragment } from "react";
import { cn } from "@/lib/utils";

// A tiny, safe formatter for admin-written topic notes and questions:
// ==text== highlights, **text** bolds, lines starting with "- " / "* " become
// bullets and "1. " numbered items. Everything else is plain text (no HTML).

const INLINE = /(==[^=\n]+==|\*\*[^*\n]+\*\*)/g;

export function InlineRich({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE).map((part, i) => {
        if (part.startsWith("==") && part.endsWith("==") && part.length > 4) {
          return (
            <mark key={i} className="hl">
              {part.slice(2, -2)}
            </mark>
          );
        }
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** Strips the formatting marks, e.g. for search or plain previews. */
export function plainText(text: string) {
  return text.replace(/==([^=\n]+)==/g, "$1").replace(/\*\*([^*\n]+)\*\*/g, "$1");
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const last = out.at(-1);
    if (!line) {
      out.push({ kind: "p", lines: [] });
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d{1,2}[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const item = (bullet ?? numbered)![1];
      if (last && last.kind === kind) last.items.push(item);
      else out.push({ kind, items: [item] });
    } else if (last && last.kind === "p" && last.lines.length) last.lines.push(line);
    else out.push({ kind: "p", lines: [line] });
  }
  return out.filter((b) => (b.kind === "p" ? b.lines.length > 0 : b.items.length > 0));
}

export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-2.5 text-[14px] leading-relaxed text-foreground/85", className)}>
      {blocks(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                <InlineRich text={l} />
              </Fragment>
            ))}
          </p>
        ) : b.kind === "ul" ? (
          <ul key={i} className="space-y-1.5">
            {b.items.map((item, j) => (
              <li key={j} className="relative pl-5 before:absolute before:top-[0.62em] before:left-1 before:size-1.5 before:rounded-full before:bg-lime-border">
                <InlineRich text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-muted-foreground">
            {b.items.map((item, j) => (
              <li key={j} className="pl-1">
                <InlineRich text={item} />
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
