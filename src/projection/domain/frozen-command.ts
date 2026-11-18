import type { FileContent } from "../../kernel/file-content.ts";
import type { CommandSubject } from "./native-command.ts";

export type FrozenCommandSubject = { readonly concept: CommandSubject["concept"]; readonly name: string };

export type FrozenCommandFile = {
  readonly nativeName: string; readonly within: string; readonly content: FileContent; readonly mode: "regular";
};

export type FrozenCommandEntry = {
  readonly subject: FrozenCommandSubject; readonly files: readonly FrozenCommandFile[] | null;
  readonly reason: string | null;
};

export type FrozenCommandSet = { readonly entries: readonly FrozenCommandEntry[]; readonly failure: string | null };
