import { createInterface } from "node:readline/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import type { ILankaInitHost } from "../../_interfaces/ILankaInitHost";
import type { ILankaInitQuestion } from "../../_interfaces/ILankaInitQuestion";

/**
 * The port over a real machine: a disk, a package manager and a person.
 *
 * The only part of this package that cannot be tested without all three, and it
 * is deliberately the smallest — every decision lives above it, in code that
 * takes the port as a parameter.
 */

/** How one question looks, and it is this file's business rather than the plan's. */
const render = (question: ILankaInitQuestion): string => {
	const rows = question.answers.map(
		(answer) => `  ${answer.id.padEnd(16)}${answer.title} — ${answer.gist}`,
	);

	return (
		`\n${question.prompt}\n${rows.join("\n")}\n\n` +
		`${question.multiple ? "Several, separated by commas" : "One"}, ` +
		`or Enter for ${question.defaultId === "" ? "none" : question.defaultId}: `
	);
};

/**
 * Whether there is anybody to ask.
 *
 * A pipe, a CI runner and a `| tee` all answer no, and all three mean the same
 * thing: take the defaults rather than block forever on a stream that will never
 * carry a newline. This is the check `--yes` exists to make explicit.
 */
const canAsk = (): boolean => process.stdin.isTTY === true && process.stdout.isTTY === true;

export const lankaNodeInitHost: ILankaInitHost = Object.freeze<ILankaInitHost>({
	exists: (path) => existsSync(path),

	readTextFile: (path) => {
		try {
			return readFileSync(path, "utf8");
		} catch {
			// Missing and unreadable are one answer here: both mean "there is
			// nothing to read", which is what every caller does something about.
			return null;
		}
	},

	writeTextFile: (path, text) => {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, text, "utf8");
	},

	/**
	 * The package manager, with its output going straight to the terminal.
	 *
	 * `inherit` rather than captured: an install prints a progress bar and, when
	 * it fails, the reason — and a scaffolder that swallowed both would be asking
	 * somebody to debug a number.
	 */
	runCommand: (command, args, cwd) => {
		const result = spawnSync(command, [...args], { cwd, stdio: "inherit", shell: true });

		return Promise.resolve(result.status ?? 1);
	},

	askQuestion: async (question) => {
		if (!canAsk()) return null;

		const reader = createInterface({ input: process.stdin, output: process.stdout });

		try {
			return (await reader.question(render(question))).trim();
		} finally {
			reader.close();
		}
	},
});
