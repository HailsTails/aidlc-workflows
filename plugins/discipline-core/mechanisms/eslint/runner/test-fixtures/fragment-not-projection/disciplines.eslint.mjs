import piece0 from "../../../CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/rin-discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece0 },
    rules: { "rin-discipline/no-class-authoring": "error" },
  },
  {
    name: "discipline-core/authorised-location/CD-14#class-syntax/src/owned.ts",
    files: ["src/owned.ts"],
    rules: { "rin-discipline/no-class-authoring": "off" },
  },
];
