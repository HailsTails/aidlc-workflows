export const projectActiveMemoryReferences = (text: string): string =>
  text.replaceAll("aidlc/spaces/<active-space>/memory/", "aidlc/active-memory/");
