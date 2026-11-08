import { accept } from "../../kernel/fixtures/accept.ts";
import {
  methodSourcePath,
  type MethodSourceKind,
  type MethodSourcePath,
} from "../domain/method-source.ts";

export const methodSource = (kind: MethodSourceKind, within: string): MethodSourcePath =>
  accept(methodSourcePath({ kind, within }));
