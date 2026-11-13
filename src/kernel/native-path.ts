const WINDOWS_START = /^(?:[A-Za-z]:|[\\/]{2})/;
const UNC_ROOT = /^[\\/]{2}([^\\/]+)[\\/]+([^\\/]+)/;
const DRIVE_ROOT = /^([A-Za-z]:)([\\/]?)/;
const WINDOWS_SEPARATORS = /[\\/]+/;
const WINDOWS_TRAILING = /[\\/]$/;

type PathFlavor = "windows" | "posix";

type JoinNativePathArgs = { readonly base: string; readonly segments: readonly string[] };

type PathRoot = { readonly root: string; readonly rest: string };

const rootOf = ({ joined, flavor }: { readonly joined: string; readonly flavor: PathFlavor }): PathRoot => {
  const unc = flavor === "windows" ? UNC_ROOT.exec(joined) : null;
  if (unc) return { root: `\\\\${unc[1]}\\${unc[2]}\\`, rest: joined.slice(unc[0].length) };
  const drive = flavor === "windows" ? DRIVE_ROOT.exec(joined) : null;
  if (drive) return { root: `${drive[1]}${drive[2] === "" ? "" : "\\"}`, rest: joined.slice(drive[0].length) };
  const rooted = joined.startsWith("/") || (flavor === "windows" && joined.startsWith("\\"));
  const root = flavor === "windows" ? "\\" : "/";
  return { root: rooted ? root : "", rest: rooted ? joined.slice(1) : joined };
};

const resolved = ({ parts, root }: { readonly parts: readonly string[]; readonly root: string }): readonly string[] =>
  parts.reduce<readonly string[]>((kept, part) => {
    if (part === "" || part === ".") return kept;
    if (part !== "..") return [...kept, part];
    if (kept.length > 0 && kept[kept.length - 1] !== "..") return kept.slice(0, -1);
    return root === "" ? [...kept, part] : kept;
  }, []);

export const joinNativePath = ({ base, segments }: JoinNativePathArgs): string => {
  const flavor: PathFlavor = WINDOWS_START.test(base) ? "windows" : "posix";
  const separator = flavor === "windows" ? "\\" : "/";
  const joined = [base, ...segments].filter((part) => part !== "").join(separator);
  const { root, rest } = rootOf({ joined, flavor });
  const parts = resolved({ parts: rest.split(flavor === "windows" ? WINDOWS_SEPARATORS : /\/+/), root });
  const trailing = parts.length > 0 && (flavor === "windows" ? WINDOWS_TRAILING : /\/$/).test(joined);
  return `${root}${parts.join(separator)}${trailing ? separator : ""}`;
};