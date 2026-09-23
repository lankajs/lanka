import type { ILankaRelayTransport } from "../../src/index";

/**
 * A transport an application writes itself: one end of a `MessagePort` pair —
 * what an iframe or a worker it created hands back.
 *
 * The two obligations a hand-written transport most easily misses are both
 * here. SEVERAL subscribers: the port has one `onmessage`, so the transport
 * keeps its own list rather than handing the port each relay's callback — the
 * second relay would replace the first. POST AT ONCE: a `MessagePort` queues
 * whatever is posted before the other side listens, so nothing needs buffering.
 */
export const createPlaygroundPortTransport = (port: MessagePort): ILankaRelayTransport => {
	const listeners = new Set<(message: unknown) => void>();

	port.onmessage = (event: MessageEvent) => {
		for (const listener of [...listeners]) listener(event.data);
	};

	return {
		post: (message) => {
			port.postMessage(message);
		},
		subscribe: (onMessage) => {
			listeners.add(onMessage);
			return () => {
				listeners.delete(onMessage);
			};
		},
	};
};
