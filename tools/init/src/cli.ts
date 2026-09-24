#!/usr/bin/env node
import { runLankaInitCli } from "./run-lanka-init-cli/runLankaInitCli";

/**
 * The executable, and the only file in this package that does anything on
 * import.
 *
 * Four lines by design: a bin has to run at import, and every line that runs at
 * import is a line no test can reach without running the program. So the command
 * itself is a function next door, given its arguments, its root and both
 * streams, and this file supplies the real ones.
 */
process.exitCode = await runLankaInitCli({
	argv: process.argv.slice(2),
	root: process.cwd(),
	write: (text) => process.stdout.write(text),
	writeError: (text) => process.stderr.write(text),
});
