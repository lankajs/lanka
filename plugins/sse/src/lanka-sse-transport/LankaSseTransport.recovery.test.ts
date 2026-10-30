import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { LankaSseTransport } from "./LankaSseTransport";

/**
 * How the stream comes back: the jittered ladder, the early auth refresh, the
 * heartbeat watchdog and page visibility.
 *
 * Each of these was reported from mobile WebViews, where a connection is lost
 * far more often than it is closed — and where the ladder, not the first
 * connection, is what the user actually lives with.
 */

class RecordingEventSource {
	public static instances: RecordingEventSource[] = [];

	public readonly listeners = new Map<string, ((event: MessageEvent) => void)[]>();
	public onopen: (() => void) | null = null;
	public onerror: (() => void) | null = null;
	public onmessage: ((event: MessageEvent) => void) | null = null;
	public closed = false;

	public constructor() {
		RecordingEventSource.instances.push(this);
	}

	public addEventListener(type: string, handler: (event: MessageEvent) => void): void {
		const list = this.listeners.get(type) ?? [];
		list.push(handler);
		this.listeners.set(type, list);
	}

	public close(): void {
		this.closed = true;
	}

	/** A frame exactly as the wire sends it: `data` is raw text. */
	public frame(type: string, data: string): void {
		const event = { data } as MessageEvent;
		if (type === "message") this.onmessage?.(event);
		for (const handler of this.listeners.get(type) ?? []) handler(event);
	}
}

const sources = (): number => RecordingEventSource.instances.length;

const lastSource = (): RecordingEventSource => {
	const source = RecordingEventSource.instances.at(-1);
	if (!source) throw new Error("no connection was opened");
	return source;
};

let visibility: DocumentVisibilityState = "visible";

const setVisibility = (state: DocumentVisibilityState): void => {
	visibility = state;
	document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
	createLanka({ host: { ...lankaTestHost, apiBaseUrl: "https://api.test" } });
	RecordingEventSource.instances = [];
	vi.stubGlobal("EventSource", RecordingEventSource);
	visibility = "visible";
	Object.defineProperty(document, "visibilityState", {
		configurable: true,
		get: () => visibility,
	});
	vi.useFakeTimers();
});

/**
 * Every transport a spec opened. A transport watching visibility listens on
 * `document`, which outlives the spec: left connected, it answers the next
 * spec's `visibilitychange` and opens a connection that spec never asked for.
 */
const opened: LankaSseTransport[] = [];

afterEach(() => {
	for (const transport of opened.splice(0)) transport.disconnect();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(document, "visibilityState");
});

/** Opens the first connection: what follows is a REconnection. */
const openedTransport = (config: ConstructorParameters<typeof LankaSseTransport>[0] = {}) => {
	const transport = new LankaSseTransport(config);
	opened.push(transport);
	const onReconnect = vi.fn();
	transport.onReconnect(onReconnect);
	transport.connect();
	lastSource().onopen?.();
	return { transport, onReconnect };
};

describe("the ladder is jittered (#14)", () => {
	it("by default an attempt waits a random share of the step, not the whole step", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.5);
		openedTransport();

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(499);
		expect(sources()).toBe(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(sources()).toBe(2);
	});

	it("two clients dropped together do not come back together", async () => {
		// A seeded source rather than the real one: the test must not be a coin toss.
		const draws = [0.2, 0.7];
		vi.spyOn(Math, "random").mockImplementation(() => draws.shift() ?? 0);
		const first = new LankaSseTransport();
		const second = new LankaSseTransport();
		first.connect();
		const firstSource = lastSource();
		second.connect();
		const secondSource = lastSource();
		firstSource.onopen?.();
		secondSource.onopen?.();

		firstSource.onerror?.();
		secondSource.onerror?.();
		await vi.advanceTimersByTimeAsync(200);
		expect(sources()).toBe(3);
		await vi.advanceTimersByTimeAsync(499);
		expect(sources()).toBe(3);
		await vi.advanceTimersByTimeAsync(1);
		expect(sources()).toBe(4);
	});

	it("no pause exceeds `maxReconnectDelayMs`", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.999);
		new LankaSseTransport({ maxReconnectDelayMs: 1500 }).connect();

		for (let round = 1; round <= 6; round += 1) {
			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(1500);
			expect(sources()).toBe(round + 1);
		}
	});

	it('`"equal"` waits at least half the step', async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		openedTransport({ reconnectJitter: "equal" });

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(499);
		expect(sources()).toBe(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(sources()).toBe(2);
	});

	it('`"none"` reproduces the 6.x schedule exactly: 1 s, 2 s, 4 s', async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		new LankaSseTransport({ reconnectJitter: "none" }).connect();

		for (const step of [1000, 2000, 4000]) {
			const before = sources();
			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(step - 1);
			expect(sources()).toBe(before);
			await vi.advanceTimersByTimeAsync(1);
			expect(sources()).toBe(before + 1);
		}
	});
});

describe("an expired token is refreshed at the first refused reconnect (#12)", () => {
	it("refreshes once and reconnects at once, and `onReconnect` fires when it opens", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		const refreshAuth = vi.fn(() => Promise.resolve(true));
		const { onReconnect } = openedTransport({ refreshAuth });

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);
		// The attempt is refused before it opens — what a 401 looks like here.
		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);

		expect(refreshAuth).toHaveBeenCalledTimes(1);
		expect(sources()).toBe(3);
		lastSource().onopen?.();
		expect(onReconnect).toHaveBeenCalledTimes(1);
	});

	it("a plain outage costs one refresh, not one per attempt", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		const refreshAuth = vi.fn(() => Promise.resolve(true));
		openedTransport({ refreshAuth, maxReconnectAttempts: 20 });

		for (let round = 0; round < 8; round += 1) {
			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(0);
		}

		expect(refreshAuth).toHaveBeenCalledTimes(1);
	});

	it("each outage gets its own refresh", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		const refreshAuth = vi.fn(() => Promise.resolve(true));
		openedTransport({ refreshAuth });

		for (let outage = 0; outage < 2; outage += 1) {
			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(0);
			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(0);
			lastSource().onopen?.();
		}

		expect(refreshAuth).toHaveBeenCalledTimes(2);
	});

	it("a refused early refresh is not a lost session — the ceiling still decides", async () => {
		// During a network outage the refresh fails for the same reason the stream
		// did. Signing the user out there turns a one-second blip into a sign-in.
		vi.spyOn(Math, "random").mockReturnValue(0);
		const onSessionLost = vi.fn();
		const refreshAuth = vi.fn(() => Promise.resolve(false));
		openedTransport({ refreshAuth, onSessionLost, maxReconnectAttempts: 3 });

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);
		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);
		expect(onSessionLost).not.toHaveBeenCalled();

		// Two more refused attempts reach the ceiling of three.
		for (let round = 0; round < 2; round += 1) {
			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(0);
		}
		expect(refreshAuth).toHaveBeenCalledTimes(2);
		expect(onSessionLost).toHaveBeenCalledTimes(1);
	});

	it("a throwing refresh leaves the ladder climbing", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		openedTransport({
			refreshAuth: () => {
				throw new Error("refresh crashed");
			},
		});

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);
		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);

		expect(sources()).toBe(3);
	});

	it('`refreshAuthOn: "exhausted"` keeps the 6.x behaviour: only at the ceiling', async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		const refreshAuth = vi.fn(() => Promise.resolve(true));
		openedTransport({ refreshAuth, refreshAuthOn: "exhausted", maxReconnectAttempts: 3 });

		for (let round = 0; round < 3; round += 1) {
			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(0);
		}
		expect(refreshAuth).not.toHaveBeenCalled();

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);
		expect(refreshAuth).toHaveBeenCalledTimes(1);
	});

	it("a throwing refresh at the ceiling reports the session lost, not an unhandled rejection", async () => {
		const onSessionLost = vi.fn();
		new LankaSseTransport({
			maxReconnectAttempts: 0,
			refreshAuth: () => {
				throw new Error("refresh crashed");
			},
			onSessionLost,
		}).connect();

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);

		expect(onSessionLost).toHaveBeenCalledTimes(1);
	});

	it("a connection made while the refresh was in flight is not followed by a stray attempt", async () => {
		// The page came back during the refresh and connected; the refresh then
		// said no. A timer armed after that would tick the counter beside the live
		// connection, and the next outage would start a rung up.
		let answer: (refreshed: boolean) => void = () => undefined;
		openedTransport({
			reconnectJitter: "none",
			visibility: { onVisible: "reconnect" },
			refreshAuth: () =>
				new Promise<boolean>((resolve) => {
					answer = resolve;
				}),
		});

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(1000);
		lastSource().onerror?.();
		// The refresh is asked in a microtask; let it be asked.
		await vi.advanceTimersByTimeAsync(0);
		setVisibility("hidden");
		setVisibility("visible");
		lastSource().onopen?.();
		answer(false);
		await vi.advanceTimersByTimeAsync(1000);
		expect(sources()).toBe(3);

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(1000);
		expect(sources()).toBe(4);
	});

	it("an explicit disconnect while the refresh is in flight keeps the stream down", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		let answer: (refreshed: boolean) => void = () => undefined;
		const { transport } = openedTransport({
			refreshAuth: () =>
				new Promise<boolean>((resolve) => {
					answer = resolve;
				}),
		});

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);
		lastSource().onerror?.();
		transport.disconnect();
		answer(true);
		await vi.advanceTimersByTimeAsync(60_000);

		expect(sources()).toBe(2);
	});
});

describe("a heartbeat watchdog catches a half-open stream (#13)", () => {
	it("no frame for `timeoutMs` closes the stream and reconnects, with `onReconnect` once", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		const { onReconnect } = openedTransport({ heartbeat: { timeoutMs: 25_000 } });
		const silent = lastSource();

		await vi.advanceTimersByTimeAsync(24_999);
		expect(silent.closed).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(silent.closed).toBe(true);

		// Fake timers give a zero delay set inside a timer one millisecond.
		await vi.advanceTimersByTimeAsync(1);
		expect(sources()).toBe(2);
		lastSource().onopen?.();
		expect(onReconnect).toHaveBeenCalledTimes(1);
	});

	it("a heartbeat every 10 s keeps the stream open, whatever its data", async () => {
		openedTransport({ heartbeat: { event: "ping", timeoutMs: 25_000 } });
		const source = lastSource();

		for (let beat = 0; beat < 10; beat += 1) {
			await vi.advanceTimersByTimeAsync(10_000);
			source.frame("ping", "");
		}

		expect(source.closed).toBe(false);
		expect(sources()).toBe(1);
	});

	it("any frame counts as proof of life", async () => {
		const transport = new LankaSseTransport({ heartbeat: { timeoutMs: 25_000 } });
		transport.on("gap.updated", () => undefined);
		transport.connect();
		const source = lastSource();
		source.onopen?.();

		for (let beat = 0; beat < 5; beat += 1) {
			await vi.advanceTimersByTimeAsync(20_000);
			source.frame(beat % 2 ? "message" : "gap.updated", JSON.stringify({ type: "x" }));
		}

		expect(source.closed).toBe(false);
	});

	it("is not armed before the stream opens, and stops on disconnect", async () => {
		const transport = new LankaSseTransport({ heartbeat: { timeoutMs: 1000 } });
		transport.connect();
		await vi.advanceTimersByTimeAsync(5_000);
		expect(lastSource().closed).toBe(false);

		lastSource().onopen?.();
		transport.disconnect();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(sources()).toBe(1);
	});

	it("without `heartbeat` a silent stream is left alone, as in 6.x", async () => {
		openedTransport();

		await vi.advanceTimersByTimeAsync(10 * 60_000);

		expect(lastSource().closed).toBe(false);
	});

	it("an event with empty data reaches its bridge as an empty payload", () => {
		// It used to be dropped as unparseable, so a bridge subscribed to a
		// keep-alive was never called and the application could not tell the
		// stream was alive.
		const transport = new LankaSseTransport();
		const heard = vi.fn();
		transport.on("ping", heard);
		transport.connect();

		lastSource().frame("ping", "");

		expect(heard).toHaveBeenCalledWith({});
	});
});

describe("page visibility (#15)", () => {
	it('`whileHidden: "pause"`: no attempt while hidden, and none counted', async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		const onSessionLost = vi.fn();
		openedTransport({
			visibility: { whileHidden: "pause" },
			maxReconnectAttempts: 1,
			onSessionLost,
		});

		setVisibility("hidden");
		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(sources()).toBe(1);

		// Had the skipped attempts counted, the one-attempt ceiling would be long
		// gone and the session declared lost while nobody was looking.
		setVisibility("visible");
		expect(sources()).toBe(2);
		expect(onSessionLost).not.toHaveBeenCalled();
	});

	it('`onVisible: "reconnect"`: back on screen, it connects now, from the bottom of the ladder', async () => {
		const { onReconnect } = openedTransport({ visibility: { onVisible: "reconnect" } });

		lastSource().onerror?.();
		setVisibility("hidden");
		setVisibility("visible");

		expect(sources()).toBe(2);
		lastSource().onopen?.();
		expect(onReconnect).toHaveBeenCalledTimes(1);
		// The timer that was pending is gone: no second connection behind this one.
		await vi.advanceTimersByTimeAsync(60_000);
		expect(sources()).toBe(2);
	});

	it("opens no second connection beside one already connecting or open", () => {
		openedTransport({ visibility: { onVisible: "reconnect" } });

		setVisibility("hidden");
		setVisibility("visible");

		expect(sources()).toBe(1);
	});

	it("a page that never once reported `visible` behaves as if the option were off", async () => {
		// Some WebViews report `hidden` and never `visible` again. A pause trusted
		// there latches for the rest of the session.
		visibility = "hidden";
		vi.spyOn(Math, "random").mockReturnValue(0);
		openedTransport({ visibility: { whileHidden: "pause" } });

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);

		expect(sources()).toBe(2);
	});

	it("without `visibility` a hidden page reconnects on the timer, as in 6.x", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		openedTransport();

		setVisibility("hidden");
		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);

		expect(sources()).toBe(2);
	});

	it("does nothing after an explicit disconnect", () => {
		const { transport } = openedTransport({
			visibility: { whileHidden: "pause", onVisible: "reconnect" },
		});

		transport.disconnect();
		setVisibility("hidden");
		setVisibility("visible");

		expect(sources()).toBe(1);
	});

	it("does not revive a session declared lost", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		openedTransport({ visibility: { onVisible: "reconnect" }, maxReconnectAttempts: 0 });

		lastSource().onerror?.();
		await vi.advanceTimersByTimeAsync(0);
		setVisibility("hidden");
		setVisibility("visible");

		expect(sources()).toBe(1);
	});
});
