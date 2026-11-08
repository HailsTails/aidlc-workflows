import {
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { CapabilityId, ProbeResult } from "../domain/capability-exclusion.ts";
import type { Capabilities } from "../application/ports.ts";

const inScratch = <T>(temp: string, use: (directory: string) => T): T => {
  const directory = mkdtempSync(join(temp, "aidlc-gate-probe-"));
  try {
    return use(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const symlinks = (temp: string): ProbeResult =>
  inScratch(temp, (directory) => {
    try {
      writeFileSync(join(directory, "target"), "x");
      symlinkSync(join(directory, "target"), join(directory, "link"));
      return { available: true, evidence: "creating a symlink works" };
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "refused";
      return { available: false, evidence: `creating a symlink is refused (${code})` };
    }
  });

const systemTemp = (): string => join(process.env["SystemRoot"] ?? "C:\\Windows", "Temp");

const lengthOf = (directory: string): number => {
  try {
    return realpathSync(directory).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

const writable = (directory: string): boolean => {
  try {
    rmdirSync(mkdtempSync(join(directory, "aidlc-gate-probe-")));
    return true;
  } catch {
    return false;
  }
};

const fixtureRoot = (temp: string): string => {
  const system = systemTemp();
  return lengthOf(system) < lengthOf(temp) && writable(system) ? system : temp;
};

const shortPathOf = (directory: string): string => {
  const folder = `.GetFolder('${directory}')`;
  const script = `(New-Object -ComObject Scripting.FileSystemObject)${folder}.ShortPath`;
  const run = Bun.spawnSync(["powershell.exe", "-NoProfile", "-Command", script]);
  return run.stdout.toString().trim();
};

const shortNames = (temp: string): ProbeResult => {
  if (process.platform !== "win32") {
    return { available: true, evidence: "not a Windows volume" };
  }
  const root = fixtureRoot(temp);
  const folder = mkdtempSync(join(root, "aidlc-gate-probe-long-folder-name-"));
  try {
    const short = shortPathOf(folder);
    const available = short.includes("~") && short !== folder;
    return {
      available,
      evidence: available
        ? `a long-named folder in ${root} has an 8.3 short path`
        : `a long-named folder in ${root} has no 8.3 short path`,
    };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
};

const listableSystemTemp = (): ProbeResult => {
  const directory = systemTemp();
  try {
    readdirSync(directory);
    return { available: true, evidence: "the system temp folder can be listed" };
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "refused";
    return { available: false, evidence: `the system temp folder cannot be listed (${code})` };
  }
};

const PROBES: Readonly<Record<CapabilityId, (temp: string) => ProbeResult>> = {
  symlinks,
  "short-names": shortNames,
  "listable-system-temp": listableSystemTemp,
};

export const capabilityProbes = (temp: string): Capabilities => {
  const cache = new Map<CapabilityId, ProbeResult>();
  return {
    probe: (id) => {
      const known = cache.get(id) ?? PROBES[id](temp);
      cache.set(id, known);
      return known;
    },
  };
};
