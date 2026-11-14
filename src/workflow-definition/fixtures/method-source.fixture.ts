import { accept } from "../../kernel/fixtures/accept.ts";
import {
  methodSourcePath,
  type MethodSourceKind,
  type MethodSourcePath,
} from "../domain/method-source.ts";

export const methodSource = (location: {
  readonly kind: MethodSourceKind;
  readonly within: string;
}): MethodSourcePath => accept(methodSourcePath(location));
