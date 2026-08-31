import type { ILankaServerEventTransport } from "../../src/index";
import type { TLankaSseEventCallback } from "../../src/index";

/**
 * A second transport, written by the APPLICATION rather than the package.
 *
 * It carries no `EventSource` and no reconnect ladder — it is a socket an app
 * already had — and every bridge above it works unchanged. That is the whole
 * claim of the port: the day a proxy strips `text/event-stream`, the change is
 * one line of configuration rather than a fork.
 */
export class PlaygroundSocketTransport implements ILankaServerEventTransport {
	private readonly listeners = new Map<string, Set<TLankaSseEventCallback>>();
	private readonly reconnects = new Set<() => void>();
	public connected = false;

	isSupported(): boolean {
		return true;
	}

	connect(): void {
		this.connected = true;
	}

	disconnect(): void {
		this.connected = false;
	}

	on(eventType: string, callback: TLankaSseEventCallback): () => void {
		const set = this.listeners.get(eventType) ?? new Set<TLankaSseEventCallback>();
		set.add(callback);
		this.listeners.set(eventType, set);

		return () => set.delete(callback);
	}

	onReconnect(callback: () => void): () => void {
		this.reconnects.add(callback);
		return () => this.reconnects.delete(callback);
	}

	/** Delivers a frame the way an open socket would. */
	deliver(eventType: string, payload: Record<string, unknown>): void {
		for (const listener of [...(this.listeners.get(eventType) ?? [])]) listener(payload);
	}

	/** The connection came back, and everything missed while it was down is stale. */
	reopen(): void {
		this.connected = true;
		for (const callback of [...this.reconnects]) callback();
	}
}
