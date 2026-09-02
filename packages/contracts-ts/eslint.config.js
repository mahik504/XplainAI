import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Minimal flat config — generated OpenAPI clients stay lint-light. */
export default tseslint.config(
  { ignores: ["dist", "node_modules", "src/generated/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
