/** A scheduler that fires when a test says so, and what it has queued. */
export interface IPlaygroundScheduler {
	scheduler: { whenIdle: (task: () => void) => void };
	/**
	 * Runs everything queued so far and waits for the sweep it starts.
	 *
	 * `settled` says what "finished" means for the caller. Without it the wait is
	 * a fixed guess, and a guess is what makes a suite pass alone and fail beside
	 * fifteen other packages — the machine is busier, the sweep lands later, and
	 * the assertion runs against a pull that has not happened yet.
	 */
	runQueued: (settled?: () => boolean) => Promise<void>;
}

/**
 * How long to keep asking, in WALL time.
 *
 * Counting steps instead measured the runner rather than the sweep: a
 * `setTimeout(5)` costs about thirteen milliseconds under jsdom, so eighty of
 * them spent 1050ms and crossed the quiet-wire ceiling — the gate then released
 * a sweep the test was asserting stayed blocked, and the package looked broken
 * because the harness was slow.
 *
 * The budget stays far below that ceiling for the same reason: the margin has to
 * survive a loaded machine.
 */
const BUDGET_MS = 250;
const STEP_MS = 10;

/**
 * Deterministic idleness.
 *
 * A scheduler waiting for a genuinely idle browser never fires under a test
 * runner, and a rung nothing exercises is a rung that quietly stops working.
 */
export const createPlaygroundScheduler = (): IPlaygroundScheduler => {
	const queued: (() => void)[] = [];

	return {
		scheduler: {
			whenIdle: (task) => {
				queued.push(task);
			},
		},

		async runQueued(settled) {
			// The scheduled task starts an ASYNC sweep, so running it is not the
			// same as it having happened.
			const tasks = queued.splice(0, queued.length);
			for (const task of tasks) task();

			const deadline = Date.now() + BUDGET_MS;
			while (Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, STEP_MS));
				if (settled?.() === true) return;
			}

			// The budget is spent, which is the answer for a sweep that was BLOCKED:
			// it stays blocked while the wire is busy, and the budget is well under
			// the quiet-wire timeout that would eventually release it.
		},
	};
};
