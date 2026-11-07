import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { escapeRegex, harnessDir, PHASES } from "./aidlc-lib.ts";
import { cutPluginFragment, personaTwinRels, type StageContribRecord, stripRecordedAdds, stripPluginRules, withFileLineEndings } from "./aidlc-plugin.ts";
import { pluginsTurnedOff } from "./aidlc-plugin-selection.ts";
import { resolveHarnessPath, runtimeHarnessName, runtimeProjectDir } from "./aidlc-runtime-paths.ts";

// --- disable-time contribution strip -----------------------------------------
//
// Compose merges a plugin's structural adds (produces/sensors/consumes/
// scopes/required_sections) into CORE stage source, where no selection filter
// reaches, and records what it actually added in a per-plugin sidecar
// (tools/data/plugin-contrib-<key>.json). Prose fragments carry their own
// sentinel markers. On disable, select-plugins strips both, so a disabled
// plugin's contributions stop steering enabled stages; re-enabling restores
// them at the plugin's next compose (`nextCompose` in aidlc-plugin.ts).

function pluginContribSidecarPath(plugin: string): string {
  return resolveHarnessPath(
    ["tools", "data", `plugin-contrib-${plugin.replace(/[^\w.-]/g, "_")}.json`],
    { mutable: true },
  );
}

function installedStagesRoot(): string {
  return resolveHarnessPath(["aidlc-common", "stages"], { mutable: true });
}

// Strip every sentinel-marked prose fragment this plugin spliced. The open
// and close markers carry the plugin name, so removal needs no sidecar.
// Anchors may themselves contain colons (after-step:9, in:Sensors), so the
// anchor segment is matched non-greedily up to the trailing :order:hash.
function removePluginFragments(content: string, plugin: string): string {
  const pE = escapeRegex(plugin);
  const openRe = new RegExp(`<!-- plugin:${pE}:.+?:\\d+:[0-9a-f]+ -->`, "g");
  let out = content;
  let match = openRe.exec(out);
  while (match !== null) {
    const close = `<!-- /${match[0].slice(5)}`;
    const closeIdx = out.indexOf(close, match.index);
    if (closeIdx === -1) break; // unpaired marker: leave as-is (doctor territory)
    out = cutPluginFragment(out, match.index, closeIdx + close.length);
    openRe.lastIndex = 0;
    match = openRe.exec(out);
  }
  return out;
}

// Strip the merged contributions of every named plugin from staged stage
// source. The caller commits the resulting staged-project diff through the
// shared transaction engine; consumed sidecars are deleted in staging and
// compose recreates them when the plugin is re-enabled.
export interface PluginStripChanges {
  plugins: string[];
  rulesTakenOut: ReadonlySet<string>;
}

function stripDisabledPluginContributions(
  plugins: readonly string[],
): PluginStripChanges {
  const rulesTakenOut = new Set<string>();
  const stagesRoot = installedStagesRoot();
  const stripped: string[] = [];
  for (const plugin of plugins) {
    const sidecar = pluginContribSidecarPath(plugin);
    let manifest: Record<string, StageContribRecord> = {};
    if (existsSync(sidecar)) {
      try {
        const parsed = JSON.parse(readFileSync(sidecar, "utf-8"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) manifest = parsed;
      } catch {
        // Unreadable sidecar: fragments still strip below; structural adds stay.
      }
    }
    let pluginTouched = false;
    for (const phase of PHASES) {
      const dir = join(stagesRoot, phase);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter((name) => name.endsWith(".md")).sort()) {
        const path = join(dir, f);
        const before = readFileSync(path, "utf-8");
        // A CRLF checkout strips as the LF text compose wrote, in its own line endings.
        const content = withFileLineEndings(before, (text) => {
          const record = manifest[f.replace(/\.md$/, "")];
          return removePluginFragments(record ? stripRecordedAdds(text, record) : text, plugin);
        });
        if (content !== before) {
          writeFileSync(path, content, "utf-8");
          pluginTouched = true;
        }
      }
    }
    // Persona contributions are prose-only, so their strip needs no sidecar
    // record: the fragment sentinels carry the plugin name. The persona's
    // native twins carry the same fragments.
    const personasDir = resolveHarnessPath(["agents"], { mutable: true });
    if (existsSync(personasDir)) {
      const projectDir = runtimeProjectDir();
      const harness = runtimeHarnessName(projectDir, harnessDir());
      for (const f of readdirSync(personasDir).filter((name) => name.endsWith(".md")).sort()) {
        const twins = personaTwinRels(harness, harnessDir(), f.replace(/\.md$/, ""))
          .map((rel) => join(projectDir, rel))
          .filter((path) => existsSync(path) && lstatSync(path).isFile());
        for (const path of [join(personasDir, f), ...twins]) {
          const before = readFileSync(path, "utf-8");
          const content = withFileLineEndings(before, (text) => removePluginFragments(text, plugin));
          if (content !== before) {
            writeFileSync(path, content, "utf-8");
            pluginTouched = true;
          }
        }
      }
    }
    if (existsSync(sidecar)) {
      rmSync(sidecar, { force: true });
      pluginTouched = true;
    }
    if (stripPluginRules(runtimeProjectDir(), plugin, true)) {
      pluginTouched = true;
      rulesTakenOut.add(plugin);
    }
    if (pluginTouched) stripped.push(plugin);
  }
  return { plugins: stripped, rulesTakenOut };
}

// The one turn-off rule, run in the staged tree a selection is built in by
// plugin select and by every config refresh: a plugin that tree's selection
// leaves off or pauses keeps nothing it merged into core stages and personas,
// nor its record of it, so its compose merges it back once it is on again.
// The implicit core plugin merges nothing.
export function stripPluginsTurnedOffWithChanges(): PluginStripChanges {
  return stripDisabledPluginContributions(pluginsTurnedOff());
}

export function stripPluginsTurnedOff(): string[] {
  return stripPluginsTurnedOffWithChanges().plugins;
}
