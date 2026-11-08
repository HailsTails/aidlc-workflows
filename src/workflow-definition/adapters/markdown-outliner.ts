import { brand } from "../../kernel/brand.ts";
import type { MarkdownOutliner } from "../application/ports.ts";
import type { OutlineHeading, TextOffset } from "../domain/outline.ts";

type HeadingLevel = OutlineHeading["level"];
const levels: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6];

const headingAt = (request: { readonly text: string; readonly lines: readonly string[];
  readonly index: number }): OutlineHeading | null => {
  const line = request.lines[request.index] ?? "";
  const atx = /^ {0,3}(#{1,6})(?:\s+|$)(.*)$/.exec(line);
  const underline = request.lines[request.index + 1] ?? "";
  const level = atx ? levels[(atx[1]?.length ?? 0) - 1]
    : levels[underline.trim().startsWith("=") ? 0 : 1];
  if (!level) return null;
  const start = request.lines.slice(0, request.index).reduce((offset, prior) =>
    offset + prior.length + 1, 0);
  const title = atx ? (atx[2] ?? "").replace(/\s+#+\s*$/, "").trim() : line.trim();
  const lineLength = atx ? line.length : line.length + underline.length + 1;
  return { level, title, start: brand<TextOffset>(start),
    contentStart: brand<TextOffset>(Math.min(start + lineLength + 1, request.text.length)) };
};

type BlockReader = (text: string) => { readonly lines: readonly {
  readonly kind: string; readonly block: number; readonly containers: readonly object[];
}[] };

export const createMarkdownOutliner = (readBlocks: BlockReader): MarkdownOutliner => ({
  outline(text) {
    const lines = text.split("\n");
    const blocks = readBlocks(text).lines;
    const headings = blocks.flatMap((line, index) => {
      if (line.kind !== "heading" || line.containers.length > 0) return [];
      if (blocks[index - 1]?.block === line.block) return [];
      const heading = headingAt({ text, lines, index });
      return heading ? [heading] : [];
    });
    return { text, headings };
  },
});
