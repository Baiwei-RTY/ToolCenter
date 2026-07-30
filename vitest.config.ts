import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      "design-prototypes/**",
      "design-qa-artifacts/**",
      "视觉稿件/**",
    ],
  },
});
