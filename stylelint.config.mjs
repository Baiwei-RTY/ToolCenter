export default {
  extends: ["stylelint-config-standard"],
  ignoreFiles: ["**/dist/**", "**/node_modules/**", "**/target/**"],
  rules: {
    "custom-property-empty-line-before": null,
    "declaration-block-no-redundant-longhand-properties": null,
    "declaration-block-single-line-max-declarations": null,
    "no-descending-specificity": null,
    "selector-class-pattern": null,
  },
};
