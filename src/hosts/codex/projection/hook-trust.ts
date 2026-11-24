import { codexHookTrustHash } from "../../../../core/tools/aidlc-command.ts";

export type CodexHookTrustIdentity = {
  readonly event: string;
  readonly command: string;
  readonly timeoutSeconds: number;
  readonly matcher: string | undefined;
};

export type CodexHookTrustHash = (identity: CodexHookTrustIdentity) => string;

export const codexHookTrust: CodexHookTrustHash = ({ event, command, timeoutSeconds, matcher }) =>
  codexHookTrustHash(event, command, timeoutSeconds, matcher);
