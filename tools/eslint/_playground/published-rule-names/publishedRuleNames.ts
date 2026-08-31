import { lankaEslintPlugin } from "../../src/index";

/** Every rule the plugin registers, by the name a consumer writes. */
export const publishedRuleNames = (): string[] => Object.keys(lankaEslintPlugin.rules);
