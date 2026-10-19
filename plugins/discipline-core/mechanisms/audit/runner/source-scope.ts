const GENERATED_FOLDER_NAMES: readonly string[] = ["node_modules", "dist", "build", "coverage", ".git"];
const GENERATED_ROOT_FOLDER_NAMES: readonly string[] = ["vendor"];

export const folderScope = (request: { readonly file: string }): "generated" | "authored" => {
  const folders = request.file.split("/").slice(0, -1);
  return GENERATED_ROOT_FOLDER_NAMES.includes(folders[0] ?? "") ||
    folders.some((folder) => GENERATED_FOLDER_NAMES.includes(folder))
    ? "generated"
    : "authored";
};
