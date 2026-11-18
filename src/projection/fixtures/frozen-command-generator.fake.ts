import type { FrozenCommandDiscovery, FrozenCommandGenerator } from "../application/ports/frozen-command.ts";

export const frozenGeneratorFailure = (failure: Error): never => { throw failure; };

export const createRecordingFrozenCommandGenerator = (discovery: FrozenCommandDiscovery = {
  stages: [], scopes: {}, selected: [],
}) => {
  const calls: string[] = [];
  const generator: FrozenCommandGenerator = {
    discover: () => { calls.push("discover"); return discovery; },
    renderScope: (name, description) => {
      calls.push(`scope:${name}`);
      return `---\nname: ${name}\n---\n${description}\n`;
    },
    renderInit: () => { calls.push("init"); return "---\nname: aidlc-init\n---\nInit\n"; },
    renderCompose: () => { calls.push("compose"); return "---\nname: aidlc-compose\n---\nCompose\n"; },
    regenerate: () => { calls.push("regenerate"); },
  };
  return { ...generator, calls: (): readonly string[] => calls };
};
