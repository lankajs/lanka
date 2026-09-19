import type { ILankaInitQuestion } from "./ILankaInitQuestion";

/**
 * Everything this package does to the world outside itself, as one port.
 *
 * Five members, and one of them asks a person a question — which is what makes
 * the port worth having. A command whose questions are `readline` calls inside
 * its own branches can only be tested by typing at it, and the branch nobody
 * types at is the branch that ships wrong.
 *
 * Injected rather than imported for the reason `@lankajs/tool-skills` gives:
 * what this refuses to overwrite, and what it hands the package manager, are
 * exactly the cases a real run must never be used to discover.
 *
 * ## What a later version may add
 *
 * A consumer implements this, so every member added later is a compile error in
 * code they did not touch — `skills/surface/SKILL.md` §6b. The promise this
 * header makes, and the one a reviewer should hold the next version to: **a new
 * member arrives OPTIONAL, and this package supplies the previous behaviour
 * when it is absent.** One port and not two — a file half and a process half —
 * because a caller holds exactly one of these and splitting it would put two
 * parameters where every call site passes the same object twice.
 */
export interface ILankaInitHost {
	exists: (path: string) => boolean;
	/** The file's text, or `null` when it is missing or unreadable. */
	readTextFile: (path: string) => string | null;
	/** Creates the parent directories and writes. Never called for a path that exists. */
	writeTextFile: (path: string, text: string) => void;
	/**
	 * Runs a command in `cwd` and answers its exit code.
	 *
	 * The package manager, and nothing else. A port member rather than a spawn
	 * call inside the apply step, so that a test asserts WHICH command was chosen:
	 * `pnpm add -D` against `npm install --save-dev` is the difference between
	 * working and printing an error in somebody's repository.
	 */
	runCommand: (command: string, args: readonly string[], cwd: string) => Promise<number>;
	/**
	 * Asks one question. `null` when nobody can be asked.
	 *
	 * `null` rather than a thrown error or a guessed answer: a pipe, a CI runner
	 * and `--yes` all mean "nobody is there", and all three mean the same thing —
	 * take the default the template already declares.
	 */
	askQuestion: (question: ILankaInitQuestion) => Promise<string | null>;
}
