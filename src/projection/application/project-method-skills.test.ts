import { expect, mock, test } from "bun:test";
import { path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import type { Rendering } from "./ports/harness.ts";
import { projectMethodSkills } from "./project-method-skills.ts";

const shortcutFile = { path: path(".claude/skills/aidlc-init/SKILL.md"),
  mode: "regular", content: { kind: "text", text: "Init\n" },
  origin: { kind: "rendered", concept: "orchestrator-skill", name: "aidlc-init" } } as const;
const doorFile = { path: path(".claude/skills/aidlc/SKILL.md"),
  mode: "regular", content: { kind: "text", text: "Door\n" },
  origin: { kind: "harness-authored", source: source("skills/aidlc/SKILL.md") } } as const;

test("one orchestrator composition retains shortcuts and the C door before session skills", () => {
  const shortcuts = mock<() => Rendering>(() => accepted([shortcutFile]));
  const door = mock<() => Rendering>(() => accepted([doorFile]));
  const session = mock<() => Rendering>(() => accepted([]));
  expect(projectMethodSkills({ method: methodSliceFixture, sessions: [{ name: "example", files: [] }],
    commands: { renderStageCommand: () => accepted([]), renderScopeCommand: () => accepted([]),
      renderOrchestratorSkill: shortcuts },
    skills: { renderOrchestratorSkill: door, renderSessionSkill: session },
  })).toEqual(accepted([shortcutFile, doorFile]));
  expect(shortcuts).toHaveBeenCalledTimes(1);
  expect(door).toHaveBeenCalledTimes(1);
  expect(session).toHaveBeenCalledWith({ skill: { name: "example", files: [] } });
});

test("the same collision owner rejects a B shortcut colliding with the C door", () => {
  expect(projectMethodSkills({ method: methodSliceFixture, sessions: [],
    commands: { renderStageCommand: () => accepted([]), renderScopeCommand: () => accepted([]),
      renderOrchestratorSkill: () => accepted([{ ...shortcutFile, path: doorFile.path }]) },
    skills: { renderOrchestratorSkill: () => accepted([doorFile]),
      renderSessionSkill: () => accepted([]) },
  })).toEqual({ ok: false, refusal: { kind: "path-collision", path: doorFile.path,
    origins: [shortcutFile.origin, doorFile.origin] } });
});

test("session skills and B commands share the final collision owner", () => {
  const commandOrigin = { kind: "rendered", concept: "stage-command", name: "requirements-analysis" } as const;
  const neutralOrigin = { kind: "neutral", source: source("skills/aidlc-knowledge/SKILL.md") } as const;
  const destination = path(".claude/skills/aidlc-knowledge/SKILL.md");
  const stage = mock<() => Rendering>(() => accepted([]))
    .mockReturnValueOnce(accepted([{ ...shortcutFile, path: destination, origin: commandOrigin }]));
  expect(projectMethodSkills({ method: methodSliceFixture,
    sessions: [{ name: "aidlc-knowledge", files: [] }],
    commands: { renderStageCommand: stage, renderScopeCommand: () => accepted([]),
      renderOrchestratorSkill: () => accepted([]) },
    skills: { renderOrchestratorSkill: () => accepted([]),
      renderSessionSkill: () => accepted([{ ...doorFile, path: destination, origin: neutralOrigin }]) },
  })).toEqual({ ok: false, refusal: {
    kind: "path-collision", path: destination, origins: [commandOrigin, neutralOrigin],
  } });
});
