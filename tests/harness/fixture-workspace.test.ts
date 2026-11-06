// covers: file:tests/harness/fixture-workspace.ts
import { expect, mock, test } from "bun:test";
import { createPathPort } from "../../plugins/discipline-core/core/platform-ports/path-port.ts";
import { createDefaultFixtureWorkspace, createFixtureWorkspace } from "./fixture-workspace.ts";

test("the workspace binds plain filesystem capabilities to one owned root", () => {
  const files = {
    temporaryRoot: mock<() => string>().mockReturnValue("/fixture"),
    read: mock<(path: string) => string>().mockReturnValue("saved bytes\r\n"),
    write: mock<(path: string, text: string) => void>(),
    directory: mock<(path: string) => void>(),
    copy: mock<(source: string, destination: string) => void>(),
    remove: mock<(path: string) => void>(),
    redirect: mock<(target: string, link: string) => void>(),
  };
  const workspace = createFixtureWorkspace({
    files,
    paths: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
  });
  workspace.write("nested/file.txt", "new bytes\r\n");
  expect(files.directory).toHaveBeenCalledWith("/fixture/nested");
  expect(files.write).toHaveBeenCalledWith("/fixture/nested/file.txt", "new bytes\r\n");
  expect(workspace.read("nested/file.txt")).toBe("saved bytes\r\n");
  expect(files.read).toHaveBeenCalledWith("/fixture/nested/file.txt");
  workspace.copyFrom("/release", "copy");
  expect(files.copy).toHaveBeenCalledWith("/release", "/fixture/copy");
  workspace.redirectDirectory("link", "copy");
  expect(files.redirect).toHaveBeenCalledWith("/fixture/copy", "/fixture/link");
  workspace.remove("copy");
  expect(files.remove).toHaveBeenNthCalledWith(1, "/fixture/copy");
  workspace[Symbol.dispose]();
  expect(files.remove).toHaveBeenNthCalledWith(2, "/fixture");
  expect(files.temporaryRoot).toHaveBeenCalledTimes(1);
});

test("native nested writes and copies retain exact private text bytes", () => {
  using workspace = createDefaultFixtureWorkspace();
  workspace.write("source/private.txt", "private\r\nUnicode: \u03bb\nNUL: \0\n");
  workspace.copyFrom(workspace.path("source"), "copy");
  expect(workspace.read("copy/private.txt")).toBe("private\r\nUnicode: \u03bb\nNUL: \0\n");
  workspace.remove("copy");
  expect(() => workspace.read("copy/private.txt")).toThrow();
  expect(workspace.read("source/private.txt")).toBe("private\r\nUnicode: \u03bb\nNUL: \0\n");
});

test("Windows drive, UNC, rooted and parent paths reject before filesystem access", () => {
  const files = {
    temporaryRoot: mock<() => string>().mockReturnValue("H:\\fixture"),
    read: mock<(path: string) => string>(),
    write: mock<(path: string, text: string) => void>(),
    directory: mock<(path: string) => void>(),
    copy: mock<(source: string, destination: string) => void>(),
    remove: mock<(path: string) => void>(),
    redirect: mock<(target: string, link: string) => void>(),
  };
  using workspace = createFixtureWorkspace({
    files,
    paths: createPathPort({ flavour: "windows", workingDirectory: () => "H:\\" }),
  });
  expect(() => workspace.read("C:\\outside.txt")).toThrow("must be relative");
  expect(() => workspace.write("C:outside.txt", "outside")).toThrow("must be relative");
  expect(() => workspace.directory("\\rooted")).toThrow("must be relative");
  expect(() => workspace.remove("..\\outside")).toThrow("outside its workspace");
  expect(() => workspace.copyFrom("H:\\release", "\\\\server\\share\\copy")).toThrow(
    "must be relative",
  );
  expect(() => workspace.redirectDirectory("link", "/outside")).toThrow("must be relative");
  expect(() => workspace.relative("C:\\outside")).toThrow("outside its workspace");
  expect(() => workspace.relative("\\\\server\\share\\outside")).toThrow("outside its workspace");
  expect(files.read).not.toHaveBeenCalled();
  expect(files.write).not.toHaveBeenCalled();
  expect(files.directory).not.toHaveBeenCalled();
  expect(files.copy).not.toHaveBeenCalled();
  expect(files.remove).not.toHaveBeenCalled();
  expect(files.redirect).not.toHaveBeenCalled();
});

test("root-relative paths and runtime candidate paths cannot escape the owned workspace", () => {
  using workspace = createDefaultFixtureWorkspace();
  using other = createDefaultFixtureWorkspace();
  expect(workspace.relative(workspace.path("candidates/data"))).toBe("candidates/data");
  expect(() => workspace.path("../escape")).toThrow("outside its workspace");
  expect(() => workspace.relative(other.root)).toThrow("outside its workspace");
  expect(() => workspace.write("../escape", "outside")).toThrow("outside its workspace");
  expect(() => workspace.remove("../escape")).toThrow("outside its workspace");
  expect(() => workspace.copyFrom(other.root, "../escape")).toThrow("outside its workspace");
  expect(() => workspace.redirectDirectory("link", "../escape")).toThrow("outside its workspace");
});

test("native directory links use Windows junctions and removing a link preserves its target", () => {
  using workspace = createDefaultFixtureWorkspace();
  workspace.write("target/record.txt", "retained\r\n");
  workspace.redirectDirectory("link", "target");
  expect(workspace.read("link/record.txt")).toBe("retained\r\n");
  workspace.remove("link");
  expect(workspace.read("target/record.txt")).toBe("retained\r\n");
});

test("disposal removes the owned temporary root", () => {
  const workspace = createDefaultFixtureWorkspace();
  workspace.write("record.txt", "temporary\n");
  workspace[Symbol.dispose]();
  expect(() => workspace.read("record.txt")).toThrow();
});

test("caller-owned disposal still runs when fixture population fails", () => {
  const workspace = createDefaultFixtureWorkspace();
  const populate = () => {
    using owned = workspace;
    owned.write("blocker", "a file cannot contain a directory\n");
    owned.write("blocker/nested.txt", "population fails here\n");
  };
  expect(populate).toThrow();
  expect(() => workspace.read("blocker")).toThrow();
});
