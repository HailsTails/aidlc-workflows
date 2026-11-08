import type { Brand } from "../../kernel/brand.ts";

export type TextOffset = Brand<number, "TextOffset">;

export type OutlineHeading = {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly title: string;
  readonly start: TextOffset;
  readonly contentStart: TextOffset;
};

export type AuthoredBody = {
  readonly text: string;
  readonly headings: readonly OutlineHeading[];
};
