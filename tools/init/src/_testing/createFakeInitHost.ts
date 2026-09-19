import type { ILankaInitHost } from "../_interfaces/ILankaInitHost";
import type { ILankaInitQuestion } from "../_interfaces/ILankaInitQuestion";

/** What a fake machine was asked to do, in order. */
export interface IFakeInitHost extends ILankaInitHost {
	readonly writes: readonly { path: string; text: string }[];
	readonly commands: readonly { command: string; args: readonly string[] }[];
	/** Every question that was actually asked, in the order they were asked. */
	readonly asked: readonly ILankaInitQuestion[];
	/** Adds a path as if it were already there, so a later run sees it. */
	readonly add: (path: string, text?: string) => void;
}

export interface IFakeInitHostState {
	/** Files that exist, by path. A path with no text is a directory or an empty file. */
	files?: Record<string, string>;
	/** What the person answers, by question subject. Absent means nobody is there. */
	answers?: Record<string, string>;
	/** What the package manager exits with. Zero unless a test is about failure. */
	exitCode?: number;
}

/**
 * A machine that records instead of acting.
 *
 * One fake for every test in this package rather than a stub per file: the
 * interesting assertions are about what was NOT written and what was NOT asked,
 * and those only mean something if every test agrees on what "written" and
 * "asked" look like.
 */
export const createFakeInitHost = (state: IFakeInitHostState = {}): IFakeInitHost => {
	const files = new Map(Object.entries(state.files ?? {}));
	const writes: { path: string; text: string }[] = [];
	const commands: { command: string; args: readonly string[] }[] = [];
	const asked: ILankaInitQuestion[] = [];

	return {
		writes,
		commands,
		asked,
		add: (path, text = "") => files.set(path, text),

		exists: (path) => files.has(path),
		readTextFile: (path) => files.get(path) ?? null,

		writeTextFile: (path, text) => {
			writes.push({ path, text });
			files.set(path, text);
		},

		runCommand: (command, args) => {
			commands.push({ command, args });

			return Promise.resolve(state.exitCode ?? 0);
		},

		askQuestion: (question) => {
			asked.push(question);

			return Promise.resolve(state.answers?.[question.subject] ?? null);
		},
	};
};
