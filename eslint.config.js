// @ts-check
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "data/cards/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: false,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
    },
  },
  {
    files: ["apps/web/**/*.tsx", "apps/web/**/*.ts"],
    ignores: ["apps/web/components/ui/link.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        { name: "next/link", message: 'Use { Link } from "@/components/ui/link" (E16.18).' },
      ],
    },
  },
  prettier,
];
