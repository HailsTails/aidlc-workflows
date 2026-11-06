import { substituteRuntimeInvocation } from "./runtime-module.ts";

export type AuthoredInvocationRequest = { readonly source: string; readonly harnessDir: string; readonly invoke: string };
export type AuthoredInvocationPort = { readonly substitute: (input: AuthoredInvocationRequest) => string };
export type AuthoredTextRequest = AuthoredInvocationRequest & { readonly letters?: string; readonly invocation?: AuthoredInvocationPort };
export const createAuthoredInvocationPort = (): AuthoredInvocationPort => ({ substitute: substituteRuntimeInvocation });

function authoredDirectoryText({ source, harnessDir, letters }: AuthoredTextRequest): string {
  const lettered = letters === undefined ? source : source.replace(/\{\{OPTION_LETTERS\}\}/g, letters);
  return lettered.replace(/\{\{HARNESS_DIR\}\}/g, harnessDir);
}

export function substituteAuthoredTokens({ invocation = createAuthoredInvocationPort(), ...request }: AuthoredTextRequest): string {
  return invocation.substitute({ source: authoredDirectoryText(request), harnessDir: request.harnessDir, invoke: request.invoke });
}
