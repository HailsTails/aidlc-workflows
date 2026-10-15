import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
  {
    files: ["blank/**"],
    processor: { preprocess: () => [""], postprocess: (messages) => messages.flat() },
  },
];
