import type { TLankaActiveRequestProbe } from "../lanka-intent-prefetch/LankaIntentPrefetch";
import type {
	ILankaIdleScheduler,
	ILankaNetworkConditions,
} from "../lanka-chunk-preload/LankaChunkPreload";

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
	 * A payload nothing refreshes must not be warmed at all — warmed and stale is
	 * strictly worse than a skeleton, because the user ACTS on old data instead of
	 * waiting for correct data. Exactly one of this and `immutableReason`.
	 */
	keptFreshBy?: string;
	/**
	 * Why this payload cannot go stale at all — the other honest answer, for data
	 * fixed for the session: nothing keeps it fresh because nothing can change it.
	 * Not a loophole for "probably will not change": if a writer exists anywhere
	 * in the product, the payload needs `keptFreshBy` instead.
	 */
	immutableReason?: string;
}

/** Failed tasks get more passes, this far apart. */
export interface ILankaWarmupRetry {
	delayMs: number;
	passes: number;
}

/** A refused `start()` tries again, this far apart, this many times. */
export interface ILankaWarmupRearm {
	delayMs: number;
	maxAttempts: number;
}

export interface ILankaDataWarmupConfig {
	/** How many tasks run at once. Defaults to 2. */
	maxConcurrent?: number;
	/**
	 * The batch size read BEFORE EVERY BATCH, when it depends on something that
	 * moves — the link's quality, typically. Wins over `maxConcurrent`. Clamped to
	 * a whole number of at least one, like `maxConcurrent`.
	 */
	concurrency?: () => number;
	/** How long `start()` waits before the first batch. Defaults to 0. */
	startDelayMs?: number;
	/** How long to wait for a quiet wire before each batch. */
	quietWireTimeoutMs?: number;
	/** When a pause nobody released expires. */
	pauseExpiryMs?: number;
	retry?: ILankaWarmupRetry;
	rearm?: ILankaWarmupRearm;
	/** Supplies the idle frame each batch waits for. Defaults to a macrotask. */
	scheduler?: ILankaIdleScheduler;
	/** A data-saving connection refuses `start()`. */
	network?: ILankaNetworkConditions;
	/**
	 * Whether the application is ready to warm — the session confirmed, typically:
	 * an unauthenticated warm-up collects 401s. Read by `start()`.
	 */
	isReady?: () => boolean;
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
	hasStarted: boolean;
	isPaused: boolean;
	completed: string[];
	failed: string[];
}

const DEFAULTS = {
	maxConcurrent: 2,
	startDelayMs: 0,
	quietWireTimeoutMs: 3_000,
	pauseExpiryMs: 10_000,
	retry: { delayMs: 5_000, passes: 1 } satisfies ILankaWarmupRetry,
	rearm: { delayMs: 15_000, maxAttempts: 6 } satisfies ILankaWarmupRearm,
};

const POLL_MS = 50;

/**
 * Warms the data the user is most likely to open next.
 *
 * ## It yields to everything
 *
 * Before each batch: an idle frame, a released pause, a quiet wire. It also
 * yields to chunks: code is needed before data, because without a chunk the
 * screen does not render at all, while without data it renders a skeleton.
 *
 * ## Every gate is escapable
 *
 * A pause expires, the wire wait has a ceiling, a refused start re-arms a
 * bounded number of times. All invisible in a desktop browser and ordinary
 * inside a mobile client, where a redirecting launch produces a pause nobody
 * releases and the session confirms a beat after the first screen.
 *
 * ## One task's failure does not cancel the rest
 *
 * A batch is not a transaction. Half a warm-up beats none, and a single failure
 * is not an event: the screen that needs the data fetches it itself.
 */
export class LankaDataWarmup {
	private readonly maxConcurrent: number;
	private readonly concurrency: (() => number) | undefined;
	private readonly startDelayMs: number;
	private readonly quietWireTimeoutMs: number;
	private readonly pauseExpiryMs: number;
	private readonly retry: ILankaWarmupRetry;
	private readonly rearm: ILankaWarmupRearm;
	private readonly scheduler: ILankaIdleScheduler;
	private readonly network: ILankaNetworkConditions;
	private readonly isReady: () => boolean;
	private readonly activeRequests: TLankaActiveRequestProbe;
	private readonly report: (message: string) => void;

	private readonly completed = new Set<string>();
	private readonly failed = new Set<string>();
	private source: () => readonly ILankaWarmupTask[] = () => [];
	private hasStarted = false;
	private paused = false;
	private pauseTimer: ReturnType<typeof setTimeout> | null = null;
	private rearmAttempts = 0;
	private rearmScheduled = false;

	public constructor(config: ILankaDataWarmupConfig = {}) {
		// Clamped up: zero or negative concurrency would be a warm-up that never
		// does anything, and would look like "the setting exists, the effect does
		// not".
		this.maxConcurrent = clampBatch(config.maxConcurrent ?? DEFAULTS.maxConcurrent);
		this.concurrency = config.concurrency;
		this.startDelayMs = config.startDelayMs ?? DEFAULTS.startDelayMs;
		this.quietWireTimeoutMs = config.quietWireTimeoutMs ?? DEFAULTS.quietWireTimeoutMs;
		this.pauseExpiryMs = config.pauseExpiryMs ?? DEFAULTS.pauseExpiryMs;
		this.retry = config.retry ?? DEFAULTS.retry;
		this.rearm = config.rearm ?? DEFAULTS.rearm;
		this.scheduler = config.scheduler ?? { whenIdle: (task) => setTimeout(task, 0) };
		this.network = config.network ?? { saveData: () => false };
		this.isReady = config.isReady ?? (() => true);
		this.activeRequests = config.activeRequests ?? (() => 0);
		this.report = config.report ?? (() => undefined);
	}

	/** Binds the task source: the tasks name ViewModels that appear later than the service. */
	public setSource(source: () => readonly ILankaWarmupTask[]): void {
		this.source = source;
	}

	/**
	 * Starts the warm-up once, after `startDelayMs`, when the gates pass.
	 *
	 * Idempotent, so an application calls it on every navigation. A refusal is
	 * NOT a latch: it re-arms, because the session confirms a beat after the first
	 * screen resolves, and a launch that lands on its final route immediately has
	 * no second navigation to retry on.
	 */
	public start(): void {
		if (this.hasStarted) return;
		if (!this.isReady()) {
			this.report("warm-up deferred — not ready yet");
			this.scheduleRearm();
			return;
		}
		if (this.network.saveData()) {
			this.report("warm-up deferred — data saving on");
			this.scheduleRearm();
			return;
		}
		this.hasStarted = true;
		void delay(this.startDelayMs).then(() => this.run());
	}

	/** Yields for the duration of a real navigation. */
	public pause(): void {
		this.paused = true;
		if (this.pauseTimer) clearTimeout(this.pauseTimer);
		// The pause EXPIRES. A release that never arrives would otherwise park the
		// warm-up for the rest of the session — a redirecting deep-link launch
		// produces exactly one such pause.
		this.pauseTimer = setTimeout(() => {
			this.pauseTimer = null;
			this.paused = false;
			this.report("pause expired — resuming");
		}, this.pauseExpiryMs);
	}

	public resume(): void {
		if (this.pauseTimer) {
			clearTimeout(this.pauseTimer);
			this.pauseTimer = null;
		}
		this.paused = false;
	}

	/**
	 * Runs tasks in order, in batches, with the retry passes. The source's tasks
	 * when none are given — the form `start()` uses.
	 */
	public async run(tasks?: readonly ILankaWarmupTask[]): Promise<void> {
		this.hasStarted = true;
		let pending = [...(tasks ?? this.source())]
			.sort((a, b) => a.order - b.order)
			.filter((task) => !this.completed.has(task.key));
		this.report(`warm-up started — ${pending.length} task(s)`);

		for (let pass = 0; pass <= this.retry.passes; pass += 1) {
			if (pending.length === 0) break;
			if (pass > 0) {
				this.report(`retrying ${pending.length} failed task(s)`);
				await delay(this.retry.delayMs);
			}
			pending = await this.drain(pending);
		}

		this.report(
			`warm-up finished — ${this.completed.size} done, ${pending.length} still failing`,
		);
	}

	public getDiagnostics(): ILankaDataWarmupDiagnostics {
		return {
			hasStarted: this.hasStarted,
			isPaused: this.paused,
			completed: [...this.completed],
			failed: [...this.failed],
		};
	}

	/** One pass; returns the tasks that failed. */
	private async drain(tasks: readonly ILankaWarmupTask[]): Promise<ILankaWarmupTask[]> {
		const failed: ILankaWarmupTask[] = [];
		let index = 0;
		while (index < tasks.length) {
			await this.waitForIdle();
			await this.waitUntilResumed();
			await this.waitForQuietWire();
			const batch = tasks.slice(index, index + this.batchSize());
			// Advance by what was TAKEN, never by less than one: a batch of zero is a
			// microtask spin no timer can end.
			index += Math.max(1, batch.length);
			const results = await Promise.allSettled(batch.map((task) => this.runOne(task)));
			results.forEach((result, at) => {
				if (result.status === "rejected") failed.push(batch[at]);
			});
		}
		return failed;
	}

	private async runOne(task: ILankaWarmupTask): Promise<void> {
		try {
			await task.run();
		} catch (error) {
			this.failed.add(task.key);
			this.report(`not warmed ${task.key}`);
			throw error;
		}
		this.completed.add(task.key);
		this.failed.delete(task.key);
		this.report(`warmed ${task.key}`);
	}

	/** Read per batch, so a degrading link narrows the next one. */
	private batchSize(): number {
		return this.concurrency ? clampBatch(this.concurrency()) : this.maxConcurrent;
	}

	private scheduleRearm(): void {
		if (this.rearmScheduled) return;
		if (this.rearmAttempts >= this.rearm.maxAttempts) {
			this.report("warm-up abandoned — re-arm attempts exhausted");
			return;
		}
		this.rearmScheduled = true;
		this.rearmAttempts += 1;
		setTimeout(() => {
			this.rearmScheduled = false;
			this.start();
		}, this.rearm.delayMs);
	}

	private waitForIdle(): Promise<void> {
		return new Promise((resolve) => {
			this.scheduler.whenIdle(resolve);
		});
	}

	private async waitUntilResumed(): Promise<void> {
		while (this.paused) await delay(POLL_MS);
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
			await delay(POLL_MS);
		}
		this.report("the wire never went quiet — proceeding anyway");
	}
}

/** A whole number of at least one; NaN and fractions are configuration mistakes, not a stop. */
const clampBatch = (value: number): number =>
	Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;

const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
