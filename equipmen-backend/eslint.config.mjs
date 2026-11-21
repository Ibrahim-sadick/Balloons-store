import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  // .qa holds throwaway diagnostic scripts, not application code.
  { ignores: ["dist/**", "node_modules/**", ".qa/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      // Unused arguments are common in Express middleware signatures.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": "off",
    },
  },
)
