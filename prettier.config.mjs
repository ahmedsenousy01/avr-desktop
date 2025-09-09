import { fileURLToPath } from "node:url";

/** @typedef {import('prettier').Config} PrettierConfig */
/** @typedef {import('prettier-plugin-tailwindcss').PluginOptions} TailwindConfig */
/** @typedef {import('@ianvs/prettier-plugin-sort-imports').PluginConfig} SortImportsConfig */

/** @type { PrettierConfig | SortImportsConfig | TailwindConfig } */
const config = {
  semi: true,
  singleQuote: false,
  trailingComma: "es5",
  printWidth: 120,
  tabWidth: 2,
  endOfLine: "lf",
  singleAttributePerLine: true,
  plugins: ["@ianvs/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss"],
  tailwindConfig: fileURLToPath(new URL("./tailwind.config.ts", import.meta.url)),
  tailwindFunctions: ["cn", "cva"],
  importOrder: [
    "<TYPES>",
    "^(react/(.*)$)|^(react$)",
    "<THIRD_PARTY_MODULES>",
    "",
    "<TYPES>^@",
    "^@shared/(.*)$",
    "^@main/(.*)$",
    "^@renderer/(.*)$",
    "",
    "^~/(.*)$",
    "^[../]",
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  importOrderTypeScriptVersion: "5.0.0",
  overrides: [
    { files: "*.json.hbs", options: { parser: "json" } },
    { files: "*.js.hbs", options: { parser: "babel" } },
  ],
};

export default config;
