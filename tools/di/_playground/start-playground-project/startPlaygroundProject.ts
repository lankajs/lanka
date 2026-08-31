import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { lankaDiVite } from "../../src/vite";
import { lankaDiWebpack } from "../../src/webpack";
import { lankaDiSetup } from "../../src/index";
import { verifyLankaDi } from "../../src/index";
import { PLAYGROUND_TSCONFIG } from "../playground-tsconfig/PLAYGROUND_TSCONFIG";
import type { IPlaygroundProject } from "../_interfaces/IPlaygroundProject";

/**
 * A consumer's project, from empty directory to wired build.
 *
 * The package's promise is that adopting the framework costs one plugin entry:
 * the barrels appear, the alias resolves, and a mapping the consumer forgot is
 * reported rather than silently un-typing the file that wires their whole app.
 *
 * That promise is a SEQUENCE across a real filesystem — scaffold, verify,
 * configure — which is why it cannot be a unit test.
 */
export const startPlaygroundProject = (): IPlaygroundProject => {
	const root = mkdtempSync(join(tmpdir(), "lanka-di-playground-"));

	const write = (relativePath: string, content: string): void => {
		const path = join(root, relativePath);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content, "utf8");
	};

	write("package.json", JSON.stringify({ name: "playground-app", type: "module" }));
	write("tsconfig.json", PLAYGROUND_TSCONFIG);

	return {
		root,
		write,
		read(relativePath) {
			try {
				return readFileSync(join(root, relativePath), "utf8");
			} catch {
				return null;
			}
		},
		verify: (options = {}) => verifyLankaDi(root, options),
		plugin: () => lankaDiVite({ root }),
		webpackPlugin: () => lankaDiWebpack({ root }),
		setup: () => lankaDiSetup({ root }),
		remove() {
			rmSync(root, { recursive: true, force: true });
		},
	};
};
