import type {
	ILankaPrefetchResource,
	TLankaRouteParams,
} from "../resource/defineLankaPrefetchResource";

/** Monotonic clock. Injected so tests can move time without faking timers. */
export type TLankaClock = () => number;

/**
 * How many requests are on the wire right now, warm-ups included.
 *
 * Injected rather than imported so the priority gate can be tested without a
 * transport.
 */
export type TLankaActiveRequestProbe = () => number;

export interface ILankaIntentPrefetchConfig {
	/** Default entry lifetime. */
	ttlMs?: number;
	/** How many warm-up requests may run at once. */
	maxConcurrent?: number;
	/** How many entries the buffer holds. */
	maxBuffered?: number;
	/** Clock. Defaults to `Date.now`. */
	clock?: TLankaClock;
	/** Counter of other requests on the wire. */
	activeRequests?: TLankaActiveRequestProbe;
	/** Where diagnostics go. The buffer is invisible; without a sink "is it working" has no answer. */
	report?: (message: string) => void;
}

interface IBufferEntry {
	promise: Promise<unknown>;
	ttlMs: number;
	/** `null` while the request is still in flight. */
	settledAt: number | null;
	domain: string;
	/**
	 * The domain fence AS OF SENDING, not as of the response.
	 *
	 * Taken at the start deliberately: a response describes the world as the
	 * server read it, so an event at any point after sending makes the response
	 * suspect.
	 */
	fenceAtStart: number;
}

export interface ILankaIntentPrefetchDiagnostics {
	inFlight: number;
	buffered: string[];
	prefetched: number;
	claimed: number;
	expired: number;
	failed: number;
	/** Entries a live event overtook. Not a failure — a refusal to serve stale data. */
	fenced: number;
	/** Warm-ups declined because the app was already waiting for something. */
	yielded: number;
	/** `claimed / prefetched` — the number that says whether a trigger earns its place. */
	hitRate: number;
}

const DEFAULTS = {
	ttlMs: 30_000,
	maxConcurrent: 2,
	maxBuffered: 8,
};

/**
 * Fetches what a screen will need while the user is still reaching for it, so
 * the screen's loader claims a finished response instead of waiting.
 *
 * ## A short-lived BUFFER, not a cache
 *
 * The distinction is the whole design:
 *
 * - only a loader reads it, and each entry exactly once;
 * - entries live seconds, so there is no invalidation bus and no way to get it
 *   wrong: a missed event cannot make a value stale, because the value does not
 *   outlive the gesture that ordered it;
 * - it writes to no ViewModel;
 * - every claim has a complete fallback. Disabling the service means `claim`
 *   returns `undefined` everywhere and behaviour is exactly what it was.
 *
 * ## Priority ladder
 *
 * ```
 * SSE  >  ordinary request  >  route chunk  >  prefetch
 * ```
 *
 * Prefetch is last and yields in two ways. By RESOURCE: while someone else's
 * request is on the wire a warm-up is not sent at all — DISCARDED rather than
 * deferred, because a deferred one arrives after the navigation it was meant to
 * serve. By CORRECTNESS: a live event always beats a warmed copy, through
 * freshness fences.
 *
 * What prefetch must never do is BLOCK either of them, which is why there is no
 * queue, no lock and no retry here.
 */
export class LankaIntentPrefetch {
	private readonly ttlMs: number;
	private readonly maxConcurrent: number;
	private readonly maxBuffered: number;
	private readonly clock: TLankaClock;
	private readonly activeRequests: TLankaActiveRequestProbe;
	private readonly report: (message: string) => void;

	private readonly buffer = new Map<string, IBufferEntry>();
	private readonly fences = new Map<string, number>();
	private prefetchedCount = 0;
	private claimedCount = 0;
	private expiredCount = 0;
	private failedCount = 0;
	private fencedCount = 0;
	private yieldedCount = 0;

	public constructor(config: ILankaIntentPrefetchConfig = {}) {
		this.ttlMs = config.ttlMs ?? DEFAULTS.ttlMs;
		this.maxConcurrent = config.maxConcurrent ?? DEFAULTS.maxConcurrent;
		this.maxBuffered = config.maxBuffered ?? DEFAULTS.maxBuffered;
		this.clock = config.clock ?? (() => Date.now());
		this.activeRequests = config.activeRequests ?? (() => 0);
		this.report = config.report ?? (() => undefined);
	}

	/** Warms one payload. */
	public lankaPrefetch<TValue>(
		resource: ILankaPrefetchResource<TValue>,
		params: TLankaRouteParams,
	): void {
		const key = this.keyOf(resource, params);

		// A key containing `undefined` can be claimed by nobody: the claimer builds
		// its key from route params and gets a different string. Rather than spend a
		// request nobody can claim, fail LOUDLY — this is what a trigger passing
		// the wrong parameter shape looks like, and it is otherwise invisible.
		if (key.includes("undefined")) {
			this.report(`rejected ${key} — params do not fit the resource`);
			return;
		}

		if (this.peek(key)) return;

		if (this.hasForeignRequestInFlight()) {
			this.yieldedCount += 1;
			this.report(`yielded ${key} — an ordinary request is on the wire`);
			return;
		}

		if (this.countInFlight() >= this.maxConcurrent) {
			this.report(`discarded ${key} — ${this.maxConcurrent} already in flight`);
			return;
		}

		const entry: IBufferEntry = {
			ttlMs: resource.ttlMs ?? this.ttlMs,
			settledAt: null,
			domain: resource.domain,
			fenceAtStart: this.fenceOf(resource.domain),
			promise: Promise.resolve(),
		};

		entry.promise = resource
			.fetch(params)
			.then((value) => {
				entry.settledAt = this.clock();
				this.report(`buffered ${key}`);
				return value;
			})
			.catch((error: unknown) => {
				// A warm-up failure must not surface as an application error: the
				// claimer fetches the data itself and shows its own error, as always.
				this.failedCount += 1;
				this.buffer.delete(key);
				this.report(`failed ${key}`);
				throw error;
			});

		// An unclaimed rejection would otherwise surface unhandled — a background
		// error reaching the app's reporting, exactly what prefetch must not do.
		// The terminal handler is attached to a DERIVED promise: the original stays
		// rejected for whoever actually awaits it.
		void entry.promise.catch(() => undefined);

		this.prefetchedCount += 1;
		this.buffer.set(key, entry);
		this.evictOverflow();
	}

	/**
	 * Hands the data to whoever would otherwise fetch it, and removes the entry:
	 * each entry is spent at most once.
	 *
	 * While the request is still in flight the SAME promise is returned — a
	 * claimer arriving mid-flight awaits it instead of issuing a duplicate. On a
	 * slow connection that duplicate is the difference between a prefetch that
	 * helps and one that gets in the way of navigation.
	 */
	public claim<TValue>(
		resource: ILankaPrefetchResource<TValue>,
		params: TLankaRouteParams,
	): Promise<TValue | null> | undefined {
		const key = this.keyOf(resource, params);
		const entry = this.peek(key);
		if (!entry) return undefined;

		this.buffer.delete(key);
		this.claimedCount += 1;
		this.report(`claimed ${key}`);

		// The fence is re-read AFTER the response arrives, not only here: an event
		// can happen while a claimed request is still in flight, by which time the
		// entry is out of the buffer and nothing could drop it. `null` sends the
		// caller to fetch for itself, which now happens after the event.
		return entry.promise.then((value) => {
			if (this.fenceOf(entry.domain) > entry.fenceAtStart) {
				this.fencedCount += 1;
				this.report(`dropped ${key} — overtaken by a live event`);
				return null;
			}
			return value as TValue;
		});
	}

	/**
	 * Marks everything in the domain older than now unusable.
	 *
	 * A COUNTER rather than a list of touched entities, deliberately: the event
	 * source knows something in the domain changed, and guessing WHICH buffer
	 * entry it was is exactly the guess that cannot be made safely. A redundant
	 * invalidation costs one ordinary request — the behaviour that existed before
	 * the buffer.
	 */
	public bumpFence(domain: string, reason: string): void {
		const next = this.fenceOf(domain) + 1;
		this.fences.set(domain, next);
		this.report(`fence ${domain} → ${next} (${reason})`);
	}

	/** Drops one resource's entries — for a mutation that invalidates them early. */
	public invalidate(resourceId: string): void {
		for (const key of [...this.buffer.keys()]) {
			if (!key.startsWith(`${resourceId}:`)) continue;
			this.buffer.delete(key);
			this.report(`reset ${key}`);
		}
	}

	/**
	 * Drops everything. MUST be called at the end of a session.
	 *
	 * The buffer holds ONE user's server responses. Entries outlive sign-out for
	 * their full TTL, and the next session's claimer computes the same key from
	 * the same id and claims them. On a shared device that is somebody else's
	 * data.
	 */
	public clear(reason: string): void {
		if (this.buffer.size === 0) return;
		this.report(`cleared ${this.buffer.size} entries — ${reason}`);
		this.buffer.clear();
	}

	public getDiagnostics(): ILankaIntentPrefetchDiagnostics {
		return {
			inFlight: this.countInFlight(),
			buffered: [...this.buffer.keys()],
			prefetched: this.prefetchedCount,
			claimed: this.claimedCount,
			expired: this.expiredCount,
			failed: this.failedCount,
			fenced: this.fencedCount,
			yielded: this.yieldedCount,
			hitRate: this.prefetchedCount === 0 ? 0 : this.claimedCount / this.prefetchedCount,
		};
	}

	// ────────────────────────────────────────────────────
	// Private
	// ────────────────────────────────────────────────────

	private fenceOf(domain: string): number {
		return this.fences.get(domain) ?? 0;
	}

	private keyOf(resource: ILankaPrefetchResource<unknown>, params: TLankaRouteParams): string {
		return `${resource.id}:${resource.identify(params)}`;
	}

	/**
	 * Returns an entry only while it is claimable, dropping it otherwise.
	 *
	 * An in-flight entry is ALWAYS claimable: its age starts at the response, so a
	 * slow request cannot expire before anyone had a chance to await it.
	 */
	private peek(key: string): IBufferEntry | undefined {
		const entry = this.buffer.get(key);
		if (!entry) return undefined;

		// The fence is checked FIRST: an entry the world overtook is not "old" but
		// wrong, and no TTL check may hand it out.
		if (this.fenceOf(entry.domain) > entry.fenceAtStart) {
			this.buffer.delete(key);
			this.fencedCount += 1;
			this.report(`dropped ${key} — overtaken by a live event`);
			return undefined;
		}

		if (entry.settledAt === null) return entry;
		if (this.clock() - entry.settledAt <= entry.ttlMs) return entry;

		this.buffer.delete(key);
		this.expiredCount += 1;
		this.report(`expired ${key}`);
		return undefined;
	}

	private countInFlight(): number {
		let count = 0;
		for (const entry of this.buffer.values()) if (entry.settledAt === null) count += 1;
		return count;
	}

	/**
	 * Whether a request NOT sent by this service is on the wire.
	 *
	 * The counter counts every request, warm-ups included — there is one send
	 * point and it cannot tell them apart — so our own in-flight count is
	 * subtracted, clamped at zero. A skew (an entry claimed while its request is
	 * still running) must read as "nothing foreign", not as a negative number that
	 * would silently disable the gate.
	 */
	private hasForeignRequestInFlight(): boolean {
		return Math.max(0, this.activeRequests() - this.countInFlight()) > 0;
	}

	/**
	 * Trims the buffer to its limit, oldest SETTLED entry first.
	 *
	 * In-flight entries are never evicted: dropping one leaves the claimer
	 * fetching in parallel with a request already sent — the exact duplicate this
	 * service exists to avoid.
	 */
	private evictOverflow(): void {
		while (this.buffer.size > this.maxBuffered) {
			const oldest = [...this.buffer.entries()].find(([, entry]) => entry.settledAt !== null);
			if (!oldest) return;
			this.buffer.delete(oldest[0]);
			this.report(`evicted ${oldest[0]} — buffer full`);
		}
	}
}
