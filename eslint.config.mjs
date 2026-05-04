import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 4px baseline grid: ban Tailwind half-step utilities that produce
// off-grid pixel values (2 / 6 / 10 / 14 px).
//
// Matches className substrings like "py-2.5", "w-3.5", "mt-0.5",
// "gap-1.5", "sm:py-1.5", "-mt-2.5", etc. Catches the spacing /
// sizing / position prefixes; visual utilities (rounded, ring, etc.)
// are not enforced.
const offGridUtilityPattern = String.raw`\b(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|size|w|h|min-[wh]|max-[wh]|inset(?:-[xy])?|top|right|bottom|left|start|end|translate-[xy])-\d+\.5\b`;

const offGridMessage =
  "Off the 4px baseline grid. Half-step Tailwind utilities (-0.5, -1.5, -2.5, -3.5) produce 2 / 6 / 10 / 14 px and break the grid. Use the closest whole-step utility (e.g. py-3 instead of py-2.5, w-4 instead of w-3.5).";

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
  ]),
  {
    files: ["src/**/*.{js,jsx,ts,tsx,mjs,cjs}"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: `Literal[value=/${offGridUtilityPattern}/]`,
          message: offGridMessage,
        },
        {
          selector: `TemplateElement[value.raw=/${offGridUtilityPattern}/]`,
          message: offGridMessage,
        },
      ],
    },
  },
]);

export default eslintConfig;
