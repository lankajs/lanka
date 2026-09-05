import type { TLankaActiveRequestProbe } from "../lanka-intent-prefetch/LankaIntentPrefetch";

/** One code-split route chunk that can be warmed. */
export interface ILankaChunkEntry {
	/** The route path pattern — the chunk's identity. */
	path: string;
	/** Order: higher goes first. */
	priority: number;
	/**
	 * Loads the CHUNK and nothing else.
	 *
	 * Not `router.preloadRoute()`: a router's own prefetch runs `beforeLoad` and
	 * the loader, which in an application have side effects — they seed state,
	 * send analytics, call the server. Router-level prefetch would produce phantom
	 * screen views, phantom requests and a corrupted funnel.
	 */
	preload: () => Promise<unknown>;
}

/** Idle scheduler: the browser's `requestIdleCallback` or a stand-in. */
export interface ILankaIdleScheduler {
	whenIdle: (task: () => void) => void;
}

/** Connection conditions: data saving, link quality. */
export interface ILankaNetworkConditions {
	/** The user asked to save data. */
	saveData: () => boolean;
}

/** Tab visibility. */
export interface ILankaVisibilityConditions {
	isVisible: () => boolean;
	onChange: (listener: () => void) => () => void;
}

export interface ILankaChunkPreloadConfig {
	/**
	 * Pause between two chunks of the sweep, so it never reads as a burst on the
	 * wire it shares. `0` runs them back to back.
	 */
	betweenChunksMs?: number;
	/** @deprecated The old name of `betweenChunksMs`; read when the new one is absent. */
	thingMs?: number;
	/** How long to wait for a quiet wire before continuing. */
	quietWireTimeoutMs?: number;
	/** When a pause nobody released expires. */
	pauseExpiryMs?: number;
	scheduler?: ILankaIdleScheduler;
	network?: ILankaNetworkConditions;
	visibility?: ILankaVisibilityConditions;
	activeRequests?: TLankaActiveRequestProbe;
	report?: (message: string) => void;
}

export interface ILankaChunkPreloadDiagnostics {
	hasStarted: boolean;
	isPaused: boolean;
	warmedPaths: string[];
	activeChunks: number;
}

const DEFAULTS = {
	betweenChunksMs: 150,
	quietWireTimeoutMs: 3_000,
	pauseExpiryMs: 10_000,
};

/**
 * Warms code-split route chunks so the FIRST navigation to a screen does not
 * pay for downloading its chunk.
 *
 * ## Its own counter, not the shared one
 *
 * A chunk is pulled by a dynamic `import()` and never passes the request layer,
 * so the request counter cannot see it. Without a separate counter the middle
 * rung of the priority ladder would not hold at all: data warm-up would read the
 * wire as quiet while two chunks download.
 *
 * A SEPARATE counter rather than a term in the shared one, because the consumers
 * differ: data warm-up must yield to chunks, the intent buffer must not — it
 * fires on a confirmed gesture toward a known screen and discards rather than
 * defers.
 *
 * ## Every gate here is escapable, deliberately
 *
 * An absolute gate switches the service off forever on one unlucky moment: a
 * pause whose release never arrives, a connection read as "slow" in the one
 * second the decision was made, a start before the router published its routes.
 * All invisible in a desktop browser and ordinary inside a mobile client. So
 * pauses expire, failures re-arm, and the visibility gate is not believed by a
 * platform that never reported itself visible.
 */
export class LankaChunkPreload {
	private readonly config: Required<
		Pick<ILankaChunkPreloadConfig, "betweenChunksMs" | "quietWireTimeoutMs" | "pauseExpiryMs">
	>;
	private readonly scheduler: ILankaIdleScheduler;
	private readonly network: ILankaNetworkConditions;
	private readonly visibility: ILankaVisibilityConditions | undefined;
	private readonly activeRequests: TLankaActiveRequestProbe;
	private readonly report: (message: string) => void;

	private readonly warmed = new Set<string>();
	private source: () => readonly ILankaChunkEntry[] = () => [];
	private hasStarted = false;
	private paused = false;
	private pauseTimer: ReturnType<typeof setTimeout> | null = null;
	private activeChunks = 0;
	private hasBeenVisible = false;

	public constructor(config: ILankaChunkPreloadConfig = {}) {
		this.config = {
			betweenChunksMs: config.betweenChunksMs ?? config.thingMs ?? DEFAULTS.betweenChunksMs,
			quietWireTimeoutMs: config.quietWireTimeoutMs ?? DEFAULTS.quietWireTimeoutMs,
			pauseExpiryMs: config.pauseExpiryMs ?? DEFAULTS.pauseExpiryMs,
		};
		this.scheduler = config.scheduler ?? { whenIdle: (task) => setTimeout(task, 0) };
		this.network = config.network ?? { saveData: () => false };
		this.visibility = config.visibility;
		this.activeRequests = config.activeRequests ?? (() => 0);
		this.report = config.report ?? (() => undefined);
	}

	/** How many chunks are downloading — read by data warm-up. */
	public getActiveCount(): number {
		return this.activeChunks;
	}

	/** Binds the chunk source: routes appear later than the service. */
	public setSource(source: () => readonly ILankaChunkEntry[]): void {
		this.source = source;
	}

	/**
	 * Starts sweeping. Called AFTER the first render: the chunk the user is
	 * waiting for must not be slowed by warming the rest.
	 */
	public start(): void {
		if (this.hasStarted) return;
		this.hasStarted = true;
		this.scheduler.whenIdle(() => {
			void this.sweep();
		});
	}

	/** Yields for the duration of a real navigation. */
	public pause(): void {
		this.paused = true;
		if (this.pauseTimer) clearTimeout(this.pauseTimer);
		// The pause EXPIRES. A release that never arrives would otherwise disable
		// warming for the rest of the session — the most common way to lose it
		// silently.
		this.pauseTimer = setTimeout(() => {
			this.pauseTimer = null;
			this.paused = false;
			this.report("pause expired — resuming");
		}, this.config.pauseExpiryMs);
	}

	public resume(): void {
		if (this.pauseTimer) {
			clearTimeout(this.pauseTimer);
			this.pauseTimer = null;
		}
		this.paused = false;
	}

	public getDiagnostics(): ILankaChunkPreloadDiagnostics {
		return {
			hasStarted: this.hasStarted,
			isPaused: this.paused,
			warmedPaths: [...this.warmed],
			activeChunks: this.activeChunks,
		};
	}

	/** Warms one chunk out of order, on a confirmed gesture. */
	public async warm(entry: ILankaChunkEntry): Promise<void> {
		if (this.warmed.has(entry.path)) return;
		this.warmed.add(entry.path);
		this.activeChunks += 1;
		try {
			await entry.preload();
			this.report(`chunk warmed ${entry.path}`);
		} catch {
			// A warm-up failure does not surface as an application error: the chunk
			// downloads again on a real navigation.
			this.warmed.delete(entry.path);
			this.report(`chunk not warmed ${entry.path}`);
		} finally {
			// The counter is released in `finally`: a leaked increment would
			// convince data warm-up forever that the wire is busy.
			this.activeChunks -= 1;
		}
	}

	private async sweep(): Promise<void> {
		if (this.network.saveData()) {
			this.report("data saving on — sweep cancelled");
			return;
		}

		const entries = [...this.source()].sort((a, b) => b.priority - a.priority);

		for (const entry of entries) {
			await this.waitUntilAllowed();
			await this.warm(entry);
			if (this.config.betweenChunksMs > 0) await delay(this.config.betweenChunksMs);
		}
	}

	/**
	 * Waits until warming is allowed: not paused, tab visible, wire quiet.
	 *
	 * Only the WIRE wait has a ceiling. A gate without one is a way to stop
	 * forever, and the wire inside a mobile client can be busy for a long time —
	 * but a pause has its own expiry, and a hidden tab is exactly when a chunk
	 * must NOT be pulled: it would spend the user's data plan on a screen nobody
	 * is looking at.
	 */
	private async waitUntilAllowed(): Promise<void> {
		while (this.paused || !this.isVisibleEnough()) await delay(50);

		const deadline = Date.now() + this.config.quietWireTimeoutMs;
		while (this.activeRequests() > 0 && Date.now() < deadline) await delay(50);
	}

	/**
	 * Whether the tab is visible enough to warm.
	 *
	 * A platform that NEVER reported itself visible is not believed: some WebViews
	 * send no visibility events at all, and trusting them would disable warming
	 * entirely — invisibly, and only there. Once it has reported visible, hidden
	 * means hidden.
	 */
	private isVisibleEnough(): boolean {
		if (!this.visibility) return true;
		if (this.visibility.isVisible()) {
			this.hasBeenVisible = true;
			return true;
		}
		if (!this.hasBeenVisible) {
			this.report("visibility gate ignored — never reported visible");
			return true;
		}
		return false;
	}
}

const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
