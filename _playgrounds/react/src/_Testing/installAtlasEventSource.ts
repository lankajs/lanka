/** The subset of `EventSource` that `LankaSseTransport` actually uses. */
interface IAtlasEventSource {
	onopen: (() => void) | null;
	onerror: (() => void) | null;
	onmessage: ((event: { data: string }) => void) | null;
	addEventListener: (type: string, listener: (event: { data: string }) => void) => void;
	close: () => void;
}

/** One `event:`/`data:` block, as a server-sent stream writes it. */
const parseBlock = (block: string): { type: string; data: string } | null => {
	const lines = block.split("\n");
	const type = lines
		.find((line) => line.startsWith("event:"))
		?.slice("event:".length)
		.trim();
	const data = lines
		.filter((line) => line.startsWith("data:"))
		.map((line) => line.slice("data:".length).trim())
		.join("\n");

	return data.length === 0 ? null : { type: type ?? "message", data };
};

/**
 * Gives node an `EventSource`, so a server-sent stream can be driven from a test.
 *
 * Node has no `EventSource` — it is a browser API — and `LankaSseTransport`
 * CHECKS for it rather than throwing, so without this the plugin is simply off
 * and a test would pass having proved nothing. That is the fourth way a check
 * reports success: it looked at something that was not running.
 *
 * A double over the real PROTOCOL rather than a stub over the transport: it
 * reads the actual `text/event-stream` the API writes, so what is exercised is
 * the parsing, the envelope and the bridge — everything except the browser's own
 * connection handling, which is not this repository's code.
 *
 * It answers a teardown rather than leaving the global behind. A global a test
 * installs and never removes is a global the next file inherits.
 */
export const installAtlasEventSource = (): (() => void) => {
	const scope = globalThis as unknown as Record<string, unknown>;
	const before = scope.EventSource;

	class AtlasEventSource implements IAtlasEventSource {
		public onopen: (() => void) | null = null;
		public onerror: (() => void) | null = null;
		public onmessage: ((event: { data: string }) => void) | null = null;

		private readonly listeners = new Map<string, ((event: { data: string }) => void)[]>();
		private readonly controller = new AbortController();

		public constructor(url: string) {
			void this.open(url);
		}

		public addEventListener(type: string, listener: (event: { data: string }) => void): void {
			this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
		}

		public close(): void {
			this.controller.abort();
		}

		private async open(url: string): Promise<void> {
			// The abort has TWO places to land, and `read` below guards only the
			// second. Closing while the response headers are still in flight rejects
			// this `fetch` instead — and since a constructor cannot await, nobody is
			// holding the promise to catch it. An unhandled rejection is how "the
			// test closed the stream" would then be reported.
			let response: Response;
			try {
				response = await fetch(url, { signal: this.controller.signal });
			} catch {
				return;
			}

			const reader = response.body?.getReader();
			if (!reader) return;

			this.onopen?.();
			await this.read(reader);
		}

		private async read(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
			const decoder = new TextDecoder();
			let pending = "";

			try {
				for (;;) {
					const chunk = await reader.read();
					if (chunk.done) break;

					pending += decoder.decode(chunk.value, { stream: true });
					const blocks = pending.split("\n\n");
					// The last piece may be half a block: a stream arrives in chunks the
					// network chose, not in message-shaped pieces.
					pending = blocks.pop() ?? "";

					for (const block of blocks) this.deliver(block);
				}
			} catch {
				// An aborted read is how this closes. Reporting it as an error would
				// send the transport into its reconnect ladder against a stream the
				// test has finished with.
			}
		}

		private deliver(block: string): void {
			const parsed = parseBlock(block);
			if (!parsed) return;

			for (const listener of this.listeners.get(parsed.type) ?? []) {
				listener({ data: parsed.data });
			}
			if (parsed.type === "message") this.onmessage?.({ data: parsed.data });
		}
	}

	scope.EventSource = AtlasEventSource;

	return () => {
		scope.EventSource = before;
	};
};
