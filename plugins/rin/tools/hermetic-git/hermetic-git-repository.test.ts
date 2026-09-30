import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  createHermeticGitRepository,
  type HermeticGitRepository,
} from "./hermetic-git-repository.ts";

const created: HermeticGitRepository[] = [];

const newRepository = (): HermeticGitRepository => {
  const repository = createHermeticGitRepository({
    namePrefix: "hermetic-selftest-",
  });
  created.push(repository);
  return repository;
};

afterEach(() => {
  created.splice(0).forEach((repository) => {
    repository.dispose();
  });
});

describe("createHermeticGitRepository", () => {
  test("initialises a working tree rather than a bare repository", () => {
    const repository = newRepository();

    expect(repository.run(["rev-parse", "--is-bare-repository"]).trim()).toBe(
      "false",
    );
  });

  test("commits without any ambient user identity configured", () => {
    const repository = newRepository();
    repository.writeFile({ relativePath: "seed.txt", body: "seed\n" });

    repository.commitAll({ message: "seed" });

    expect(repository.run(["log", "-1", "--format=%s"]).trim()).toBe("seed");
  });

  test("survives a leaked GIT_DIR pointing at another repository", () => {
    const victim = newRepository();
    victim.writeFile({ relativePath: "seed.txt", body: "seed\n" });
    victim.commitAll({ message: "seed" });
    process.env["GIT_DIR"] = join(victim.path, ".git");

    const isolated = newRepository();
    isolated.writeFile({ relativePath: "other.txt", body: "other\n" });
    isolated.commitAll({ message: "isolated" });
    delete process.env["GIT_DIR"];

    expect(victim.run(["config", "--get", "core.bare"]).trim()).toBe("false");
  });

  test("keeps a leaked GIT_DIR from capturing the new repository's commits", () => {
    const victim = newRepository();
    victim.writeFile({ relativePath: "seed.txt", body: "seed\n" });
    victim.commitAll({ message: "seed" });
    process.env["GIT_DIR"] = join(victim.path, ".git");

    const isolated = newRepository();
    isolated.writeFile({ relativePath: "other.txt", body: "other\n" });
    isolated.commitAll({ message: "isolated" });
    delete process.env["GIT_DIR"];

    expect(victim.run(["log", "-1", "--format=%s"]).trim()).toBe("seed");
  });

  test("removes the whole enclosure on dispose", () => {
    const repository = createHermeticGitRepository({
      namePrefix: "hermetic-dispose-",
    });
    const path = repository.path;

    repository.dispose();

    expect(existsSync(path)).toBe(false);
  });
});
