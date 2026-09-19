import type { lankaDiVite } from "../../src/vite";
import type { lankaDiWebpack } from "../../src/webpack";
import type { lankaDiSetup } from "../../src/index";
import type { migrateLankaDi } from "../../src/index";
import type { resolveLankaDiDir } from "../../src/index";
import type { verifyLankaDi } from "../../src/index";
import type { IVerifyLankaDiOptions, TLankaDiDirname } from "../../src/index";

/** How a project starts out. */
export interface IPlaygroundProjectOptions {
	/**
	 * The layout this consumer adopted the framework with.
	 *
	 * Defaults to the contract's default — a new project. A scene passes
	 * `.lanka_di` to be the other kind of consumer, the one that arrived earlier.
	 */
	readonly dirname?: TLankaDiDirname;
}

/** What a command a person types answers: an exit code and two streams. */
export interface IPlaygroundCliRun {
	readonly code: number;
	readonly out: string;
	readonly err: string;
}

/** A consumer's project on a real filesystem, and what may be done to it. */
export interface IPlaygroundProject {
	root: string;
	/** The layout it started in. */
	dirname: TLankaDiDirname;
	/** Reads a file from the project, or null when it is not there. */
	read: (relativePath: string) => string | null;
	/** Writes a file, creating directories as a developer's editor would. */
	write: (relativePath: string, content: string) => void;
	/** Runs the plugin's verification, as the dev server does on start-up. */
	verify: (options?: IVerifyLankaDiOptions) => ReturnType<typeof verifyLankaDi>;
	/** Which barrel directory this project turns out to use. */
	where: () => ReturnType<typeof resolveLankaDiDir>;
	/** Moves it to the other one, as `lanka-di migrate` does. */
	migrate: (options?: {
		to?: TLankaDiDirname;
		dryRun?: boolean;
	}) => ReturnType<typeof migrateLankaDi>;
	/** The command a person actually types, with both streams captured. */
	cli: (...argv: string[]) => IPlaygroundCliRun;
	/** The plugin itself, as a vite config would build it. */
	plugin: () => ReturnType<typeof lankaDiVite>;
	/** The same project, wired for the other bundler. */
	webpackPlugin: () => ReturnType<typeof lankaDiWebpack>;
	/** The primitive every adapter is built from, over the same project. */
	setup: () => ReturnType<typeof lankaDiSetup>;
	remove: () => void;
}
