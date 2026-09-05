import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { LankaSseTransport } from "./LankaSseTransport";

/**
 * A fake `EventSource` that keeps EVERY listener it was given.
 *
 * The fake in the sibling spec keeps one per type, which is how a doubled
 * listener hid: a `Map` overwrote the second registration, and the test saw
 * one delivery where a real engine delivered two.
 */
class ListingEventSource {
	public static instances: ListingEventSource[] = [];

	public readonly url: string;
	public readonly listeners = new Map<string, ((event: MessageEvent) => void)[]>();
	public onopen: (() => void) | null = null;
	public onerror: (() => void) | null = null;
	public onmessage: ((event: MessageEvent) => void) | null = null;

	public constructor(url: string) {
		this.url = url;
		ListingEventSource.instances.push(this);
	}

	public addEventListener(type: string, handler: (event: MessageEvent) => void): void {
		const list = this.listeners.get(type) ?? [];
		list.push(handler);
		this.listeners.set(type, list);
	}

	public close(): void {}

	public emit(type: string, data: unknown): void {
		const payload = { data: JSON.stringify(data) } as MessageEvent;
		for (const handler of this.listeners.get(type) ?? []) handler(payload);
	}

	public listenerCount(type: string): number {
		return this.listeners.get(type)?.length ?? 0;
	}
}

const lastSource = (): ListingEventSource => {
	const source = ListingEventSource.instances.at(-1);
	if (!source) throw new Error("no connection was opened");
	return source;
};

beforeEach(() => {
	createLanka({ host: lankaTestHost });
	ListingEventSource.instances = [];
	vi.stubGlobal("EventSource", ListingEventSource);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("LankaSseTransport — subscribing again to a type that was dropped", () => {
	// The connection's listeners are never removed, only the connection is. A
	// type that was subscribed, dropped and subscribed again got a SECOND
	// listener on the same connection, and every handler for it then ran twice
	// per event — a screen refreshing twice, a toast shown twice.
	it("delivers each event once", () => {
		const transport = new LankaSseTransport();
		const off = transport.on("gap.updated", vi.fn());
		transport.connect();
		off();
		const heard = vi.fn();
		transport.on("gap.updated", heard);

		lastSource().emit("gap.updated", { id: 7 });

		expect(heard).toHaveBeenCalledTimes(1);
		expect(lastSource().listenerCount("gap.updated")).toBe(1);
	});

	it("listens on a new connection after the old one closed", () => {
		const transport = new LankaSseTransport();
		const heard = vi.fn();
		transport.on("gap.updated", heard);
		transport.connect();
		transport.disconnect();
		transport.connect();

		lastSource().emit("gap.updated", { id: 7 });

		expect(ListingEventSource.instances).toHaveLength(2);
		expect(lastSource().listenerCount("gap.updated")).toBe(1);
		expect(heard).toHaveBeenCalledTimes(1);
	});
});
