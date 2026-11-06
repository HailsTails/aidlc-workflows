import type { SourceOrigin, SourceContentDigest } from "./source-origin.ts";
export type CoreSkillSource = { readonly name: string; readonly origin: SourceOrigin; readonly text: string };
export type CoreSkillSources = { readonly skills: readonly CoreSkillSource[]; readonly inputs: readonly SourceContentDigest[] };
