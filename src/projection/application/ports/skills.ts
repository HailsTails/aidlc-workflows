import type { FileSystemError, ReadTreeArgs, TreeReading } from "../../../kernel/file-system-port.ts";
import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { SourcePath } from "../../../kernel/values.ts";
import type { Method } from "../../../workflow-definition/domain/method.ts";
import type { AuthoredHostFile } from "../../domain/host-surface.ts";
import type { SessionSkill, SkillTableRenderer } from "../../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";
import type { TokenBindings } from "../../domain/template-token.ts";
import type { CommandPlacement, CommandSource } from "./commands.ts";
import type { Harness, Rendering } from "./harness.ts";
import type { AuthoredFilePreparer } from "./host-sources.ts";

export type SkillRenderingInputs = {
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly tables: SkillTableRenderer;
};

export type HostSkillRenderer = (
  inputs: SkillRenderingInputs,
) => Pick<Harness, "renderOrchestratorSkill" | "renderSessionSkill">;

export interface SessionSkillTreeReader {
  readTree(readTreeArgs: ReadTreeArgs): Promise<Result<TreeReading, FileSystemError>>;
}

export interface SessionSkillSource {
  read(): Promise<Result<readonly SessionSkill[], readonly ProjectionRefusal[]>>;
}

export type SessionSkillCapture = {
  readonly folder: URL;
  readonly source: SourcePath;
};

export type SessionSkillReading = (
  capture: SessionSkillCapture,
) => Promise<Result<readonly SessionSkill[], readonly ProjectionRefusal[]>>;

export type SkillProjectionRequest = {
  readonly method: Method;
  readonly host: HostIdentity;
  readonly projectRoot: URL;
  readonly render: HostSkillRenderer;
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly commands: CommandSource;
  readonly place: CommandPlacement;
  readonly sessions: readonly SessionSkill[];
};

export type SkillProjection = (request: SkillProjectionRequest) => Promise<Rendering>;
