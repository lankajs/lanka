/**
 * Everything this package does to a file system, as one port.
 *
 * Injected rather than imported so the whole tool is testable without touching a
 * disk: what it refuses to overwrite, and what it reports, are exactly the cases
 * a real run must never be used to discover.
 */
export interface ILankaSkillHost {
	/** Parsed JSON, or `null` when the file is missing or unreadable. */
	readJsonFile: (path: string) => unknown;
	/**
	 * Where an installed package actually lives, asked from a project directory.
	 *
	 * A port member rather than `<root>/node_modules/<name>` spelled inline,
	 * because that path is wrong in three ordinary situations: a workspace whose
	 * dependencies are hoisted to the repository root, a package manager that
	 * links rather than copies, and Yarn's Plug'n'Play, which has no
	 * `node_modules` at all. Resolution answers all three; a string does not.
	 *
	 * `null` when the package is declared but not installed.
	 */
	resolvePackageDir: (packageName: string, from: string) => string | null;
	/** Directory names directly inside a path. Empty when it does not exist. */
	listDirectories: (path: string) => readonly string[];
	exists: (path: string) => boolean;
	/** Replaces the destination wholesale. */
	copyDirectory: (from: string, to: string) => void;
	writeTextFile: (path: string, text: string) => void;
}
