import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Script solto de captura de tela (fora do sistema)
    "screenshot.js",
    "scripts/**/*.cjs",
  ]),
  {
    files: ["**/*.{ts,tsx,jsx}"],
    rules: {
      // As telas carregam os dados ao abrir (padrão do projeto). O aviso sugere uma biblioteca de dados;
      // fica como AVISO visível, sem travar a verificação, até as telas serem reescritas.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
