import type { lankaDiVite } from "../../src/vite";
import type { lankaDiWebpack } from "../../src/webpack";
import type { lankaDiSetup } from "../../src/index";
import type { verifyLankaDi } from "../../src/index";

/** A consumer's project on a real filesystem, and what may be done to it. */
export interface IPlaygroundProject {
	root: string;
	/** Reads a file from the project, or null when it is not there. */
	read: (relativePath: string) => string | null;
	/** Writes a file, creating directories as a developer's editor would. */
	write: (relativePath: string, content: string) => void;
	/** Runs the plugin's verification, as the dev server does on start-up. */
	verify: (options?: { scaffold?: boolean }) => ReturnType<typeof verifyLankaDi>;
	/** The plugin itself, as a vite config would build it. */
	plugin: () => ReturnType<typeof lankaDiVite>;
	/** The same project, wired for the other bundler. */
	webpackPlugin: () => ReturnType<typeof lankaDiWebpack>;
	/** The primitive every adapter is built from, over the same project. */
	setup: () => ReturnType<typeof lankaDiSetup>;
	remove: () => void;
}
