import type { TLankaActiveRequestProbe } from "../lanka-intent-prefetch/LankaIntentPrefetch";

/** One payload that can be fetched before the user opens the screen. */
export interface ILankaWarmupTask {
	/** Stable identifier: for deduplication and for logs. */
	key: string;
	/** Execution order; lower runs earlier. */
	order: number;
	/**
	 * The action that fetches the data.
	 *
	 * Must be SILENT: a warm-up must not raise a loading flag (a skeleton would
	 * flash over a readable screen) and must not report an error — nothing on
	 * screen could show it. And it is not a route loader: loaders have side
	 * effects, and warming through one would, for example, mark notifications read
	 * that the user never opened.
	 */
	run: () => Promise<unknown>;
	/**
	 * What keeps this payload fresh AFTER warming.
	 *
	 * Required: a payload nothing refreshes must not be warmed at all — warmed
	 * and stale is strictly worse than a skeleton, because the user ACTS on old
	 * data instead of waiting for correct data.
	 */
	keptFreshBy: string;
}

export interface ILankaDataWarmupConfig {
	/** How many tasks run at once. Defaults to 2. */
	maxConcurrent?: number;
	/** How long to wait for a quiet wire before each batch. */
	quietWireTimeoutMs?: number;
	/**
	 * What counts as a busy wire.
	 *
	 * Both requests and downloading chunks: a chunk never passes the request
	 * layer, and without it the wire would read as quiet mid-sweep.
	 */
	activeRequests?: TLankaActiveRequestProbe;
	report?: (message: string) => void;
}

export interface ILankaDataWarmupDiagnostics {
	hasRun: boolean;
	completed: string[];
	failed: string[];
}

/**
 * Warms the data the user is most likely to open next.
 *
 * ## It yields to everything
 *
 * It also yields to chunks: code is needed before data, because without a chunk
 * the screen does not render at all, while without data it renders a skeleton.
 *
 * ## One task's failure does not cancel the rest
 *
 * A batch is not a transaction. Half a warm-up beats none, and a single failure
 * is not an event: the screen that needs the data fetches it itself.
 */
export class LankaDataWarmup {
	private readonly maxConcurrent: number;
	private readonly quietWireTimeoutMs: number;
	private readonly activeRequests: TLankaActiveRequestProbe;
	private readonly report: (message: string) => void;

	private readonly completed = new Set<string>();
	private readonly failed = new Set<string>();
	private hasRun = false;

	public constructor(config: ILankaDataWarmupConfig = {}) {
		// Clamped up: zero or negative concurrency would be a warm-up that never
		// does anything, and would look like "the setting exists, the effect does
		// not".
		this.maxConcurrent = Math.max(1, config.maxConcurrent ?? 2);
		this.quietWireTimeoutMs = config.quietWireTimeoutMs ?? 3_000;
		this.activeRequests = config.activeRequests ?? (() => 0);
		this.report = config.report ?? (() => undefined);
	}

	/** Runs tasks in order, in batches of `maxConcurrent`. */
	public async run(tasks: readonly ILankaWarmupTask[]): Promise<void> {
		this.hasRun = true;
		const pending = [...tasks]
			.sort((a, b) => a.order - b.order)
			.filter((task) => !this.completed.has(task.key));

		for (let index = 0; index < pending.length; index += this.maxConcurrent) {
			await this.waitForQuietWire();
			const batch = pending.slice(index, index + this.maxConcurrent);
			await Promise.all(batch.map((task) => this.runOne(task)));
		}
	}

	public getDiagnostics(): ILankaDataWarmupDiagnostics {
		return {
			hasRun: this.hasRun,
			completed: [...this.completed],
			failed: [...this.failed],
		};
	}

	private async runOne(task: ILankaWarmupTask): Promise<void> {
		try {
			await task.run();
			this.completed.add(task.key);
			this.report(`warmed ${task.key}`);
		} catch {
			this.failed.add(task.key);
			this.report(`not warmed ${task.key}`);
		}
	}

	/**
	 * Waits for silence, but no longer than the ceiling.
	 *
	 * A gate without one is a way to never start: the wire can be busy for a long
	 * time, and a warm-up waiting for perfect silence quietly never runs.
	 */
	private async waitForQuietWire(): Promise<void> {
		const deadline = Date.now() + this.quietWireTimeoutMs;
		while (Date.now() < deadline) {
			if (this.activeRequests() === 0) return;
			await delay(50);
		}
		this.report("the wire never went quiet — proceeding anyway");
	}
}

const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
