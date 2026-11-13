import type { HarnessAssembly } from "./harness-assembly.ts";
import type { MemoryCompanionReading, WorkspaceProjection } from "./workspace.ts";
import type { DelegateShellFacts } from "./delegate-shell.ts";
import type { SettingsCapabilities } from "./settings.ts";
import type { NeutralReading, DocumentProjection } from "./documents.ts";
import type { Result } from "../../../kernel/result.ts";
import type { AuthoredHostFile } from "../../domain/host-surface.ts";
import type { NativeCommandRoutes } from "../../domain/native-command.ts";
import type { CompiledMethodFiles, ProjectionRefusal } from "../../domain/projection.ts";
import type { AgentProjection } from "./agents.ts";
import type { CommandSource, CommandSourceRequest } from "./commands.ts";
import type { CompiledMethodRequest } from "./compiled-method.ts";
import type { HostSourceCapture } from "./host-sources.ts";
import type { HostSurfaceProjection } from "./host-surface.ts";
import type { RuntimeProjection, RuntimeReading } from "./runtime.ts";
import type { SettingsProjection } from "./settings.ts";
import type { SessionSkillReading, SkillProjection } from "./skills.ts";

export interface BuildProjection {
  readonly assembleHarness: HarnessAssembly;
  readonly projectWorkspace: WorkspaceProjection;
  readonly readMemoryCompanions: MemoryCompanionReading;
  readonly delegateShellFacts: DelegateShellFacts;
  readonly settingsCapabilities: SettingsCapabilities;
  readonly nativeCommands: NativeCommandRoutes;
  readonly readNeutral: NeutralReading;
  readonly projectDocuments: DocumentProjection;
  readonly projectSettings: SettingsProjection;
  readonly readRuntime: RuntimeReading;
  readonly projectRuntime: RuntimeProjection;
  readonly projectHostSurface: HostSurfaceProjection;
  readonly readSessionSkills: SessionSkillReading;
  readonly projectSkills: SkillProjection;
  readonly projectAgents: AgentProjection;
  serializeMethod(request: CompiledMethodRequest): CompiledMethodFiles;
  readHostSources(
    capture: HostSourceCapture,
  ): Promise<Result<readonly AuthoredHostFile[], readonly ProjectionRefusal[]>>;
  prepareCommandSource(request: CommandSourceRequest): Promise<CommandSource>;
}
