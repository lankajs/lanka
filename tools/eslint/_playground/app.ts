/**
 * A consumer's project, linted by the config this package publishes.
 *
 * The package's promise is that a consumer adds one config entry and their
 * layering is enforced. The fixture files live apart from the linting because
 * they are what changes: a new rule is a new entry beside the decision it makes.
 */
export { lintWithPublishedConfig } from "./lint-with-published-config/lintWithPublishedConfig";
export { lintWithPinnedStyles } from "./lint-with-pinned-styles/lintWithPinnedStyles";
export { publishedRuleNames } from "./published-rule-names/publishedRuleNames";
export { playgroundFiles } from "./playground-files/playgroundFiles";
export type { IPlaygroundFile } from "./_interfaces/IPlaygroundFile";
