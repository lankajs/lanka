import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IMicroFrontendEntry } from "./IMicroFrontendBuild";

/**
 * Removes the source-map comments the bundled packages brought with them.
 *
 * A package's own `//# sourceMappingURL=Schema.js.map` survives inside a webpack
 * or Rspack bundle, pointing at a file the build never emitted, and whatever
 * loads the bundle then goes looking for it. A bundle should not point at maps
 * it lacks. Vite drops them itself.
 */
export const dropForeignSourceMaps = (
	directory: string,
	modules: readonly IMicroFrontendEntry[],
): void => {
	for (const { name } of modules) {
		const file = join(directory, `${name}.js`);
		writeFileSync(
			file,
			readFileSync(file, "utf8").replace(/^\/\/# sourceMappingURL=.*$/gm, ""),
		);
	}
};
