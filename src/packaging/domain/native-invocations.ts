import type { NativeCommandRoutes } from "../../projection/domain/native-command.ts";

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const nativeBareToolPattern = (routes: NativeCommandRoutes): RegExp => new RegExp(
  String.raw`\bbun\s+aidlc-(${routes.delegates.map(escapeRegExp).join("|")})\.ts`, "gi",
);
