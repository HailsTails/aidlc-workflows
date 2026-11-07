export type InvocationTextBinding = Readonly<{
  invoke: string;
  toolPrefix: string;
  trustedNamespace: string;
}>;

export function substituteInvocationTokens({ source, binding }: Readonly<{
  source: string;
  binding: InvocationTextBinding;
}>): string {
  return source
    .replace(/\{\{INVOKE\}\}/g, binding.invoke)
    .replace(/\{\{TOOL_PREFIX\}\}/g, binding.toolPrefix)
    .replace(/\{\{TRUSTED_NAMESPACE\}\}/g, binding.trustedNamespace);
}

export function substituteAuthoredTokens({ source, harnessDir, letters, binding }: Readonly<{
  source: string;
  harnessDir: string;
  letters?: string | undefined;
  binding: InvocationTextBinding;
}>): string {
  const lettered = letters === undefined ? source : source.replace(/\{\{OPTION_LETTERS\}\}/g, letters);
  return substituteInvocationTokens({ source: lettered.replace(/\{\{HARNESS_DIR\}\}/g, harnessDir), binding });
}
