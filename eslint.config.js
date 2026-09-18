import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";

/** @type {import('eslint').Linter.Config[]} */
export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { ignores: ["dist/", ".next/", "node_modules/"] },
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
]);
