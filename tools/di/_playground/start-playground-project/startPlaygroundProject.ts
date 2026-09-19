import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname as parentOf, join } from "node:path";
import { lankaDiVite } from "../../src/vite";
import { lankaDiWebpack } from "../../src/webpack";
import { lankaDiContract } from "../../src/index";
import { lankaDiSetup } from "../../src/index";
import { migrateLankaDi } from "../../src/index";
import { resolveLankaDiDir } from "../../src/index";
import { runLankaDiCli } from "../../src/index";
import { verifyLankaDi } from "../../src/index";
import { playgroundTsconfig } from "../playground-tsconfig/playgroundTsconfig";
import type { TLankaDiDirname } from "../../src/index";
import type {
	IPlaygroundCliRun,
	IPlaygroundProject,
	IPlaygroundProjectOptions,
} from "../_interfaces/IPlaygroundProject";

/** Writes a file into the project, creating directories as an editor would. */
const writerIn =
	(root: string) =>
	(relativePath: string, content: string): void => {
		const path = join(root, relativePath);
		mkdirSync(parentOf(path), { recursive: true });
		writeFileSync(path, content, "utf8");
	};

const readIn = (root: string, relativePath: string): string | null => {
	try {
		return readFileSync(join(root, relativePath), "utf8");
	} catch {
		return null;
	}
};

/**
 * A temporary root with a `package.json` and a correct `tsconfig`.
 *
 * `adopted` is the layout a project ALREADY has, and it decides one thing: the
 * directory is created. That is what makes the rest of the scene honest —
 * nothing pins the answer afterwards, so every call resolves it off the disk
 * exactly as a consumer's build does, including the calls that come after a
 * migration has moved it.
 *
 * Left out, the root is empty and the default decides, which is the other kind
 * of consumer and the one most scenes are about.
 */
const layOutProject = (adopted: TLankaDiDirname | undefined, dirname: TLankaDiDirname): string => {
	const root = mkdtempSync(join(tmpdir(), "lanka-di-playground-"));
	const write = writerIn(root);

	write("package.json", JSON.stringify({ name: "playground-app", type: "module" }));
	write("tsconfig.json", playgroundTsconfig(dirname));

	if (adopted) mkdirSync(join(root, adopted), { recursive: true });

	return root;
};

/**
 * The command a person types, with both streams captured.
 *
 * Captured rather than printed: what a consumer READS is half of what this
 * command does, and a scene that let it go to the terminal would be asserting
 * the exit code and taking the rest on trust.
 */
const runCli = (root: string, argv: readonly string[]): IPlaygroundCliRun => {
	let out = "";
	let err = "";
	const code = runLankaDiCli({
		argv,
		root,
		write: (text) => (out += text),
		writeError: (text) => (err += text),
	});
	return { code, out, err };
};

/**
 * A consumer's project, from empty directory to wired build.
 *
 * The package's promise is that adopting the framework costs one plugin entry:
 * the barrels appear, the alias resolves, and a mapping the consumer forgot is
 * reported rather than silently un-typing the file that wires their whole app.
 *
 * That promise is a SEQUENCE across a real filesystem — scaffold, verify,
 * configure — which is why it cannot be a unit test.
 *
 * `dirname` is what layout the project starts in. It defaults to the contract's
 * default, which is what a NEW project gets; a scene passes `.lanka_di` to be
 * the other kind of consumer — the one that adopted the framework earlier and
 * must keep working exactly as well.
 */
export const startPlaygroundProject = (
	options: IPlaygroundProjectOptions = {},
): IPlaygroundProject => {
	const dirname = options.dirname ?? lankaDiContract.dirname;
	const root = layOutProject(options.dirname, dirname);
	const write = writerIn(root);

	return {
		root,
		dirname,
		write,
		read: (relativePath) => readIn(root, relativePath),
		verify: (verifyOptions = {}) => verifyLankaDi(root, verifyOptions),
		where: () => resolveLankaDiDir(root),
		migrate: (migrateOptions = {}) => migrateLankaDi({ root, ...migrateOptions }),
		cli: (...argv) => runCli(root, argv),
		plugin: () => lankaDiVite({ root }),
		webpackPlugin: () => lankaDiWebpack({ root }),
		setup: () => lankaDiSetup({ root }),
		remove() {
			rmSync(root, { recursive: true, force: true });
		},
	};
};
