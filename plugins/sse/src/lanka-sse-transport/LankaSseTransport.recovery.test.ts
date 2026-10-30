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

beforeEach(() => {
	createLanka({ host: { ...lankaTestHost, apiBaseUrl: "https://api.test" } });
	RecordingEventSource.instances = [];
	vi.stubGlobal("EventSource", RecordingEventSource);
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

/** Opens the first connection: what follows is a REconnection. */
const openedTransport = (config: ConstructorParameters<typeof LankaSseTransport>[0] = {}) => {
	const transport = new LankaSseTransport(config);
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
