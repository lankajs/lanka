/**
 * The server, as far as this application can tell.
 *
 * `WebSocket` IS the outside world for this package, so it is the one thing
 * stubbed. Everything above it — the outbox, the heartbeat, the reconnect
 * ladder, the frame envelope, bridges, the marker — is the package's own code
 * running for real.
 */
export class PlaygroundWebSocket {
	public static instances: PlaygroundWebSocket[] = [];

	public onopen: (() => void) | null = null;
	public onerror: (() => void) | null = null;
	public onclose: (() => void) | null = null;
	public onmessage: ((event: MessageEvent) => void) | null = null;

	/** The `WebSocket` states this stub needs: 0 connecting, 1 open, 3 closed. */
	public readyState = 0;
	/** Every frame the application sent, in order. */
	public readonly sent: string[] = [];

	public readonly url: string;
	public readonly protocols?: string | readonly string[];

	public constructor(url: string, protocols?: string | readonly string[]) {
		// A parameter property is a runtime construct, and this repository compiles
		// with `erasableSyntaxOnly`: types may not emit code.
		this.url = url;
		this.protocols = protocols;
		PlaygroundWebSocket.instances.push(this);
	}

	public send(frame: string): void {
		this.sent.push(frame);
	}

	public close(): void {
		this.readyState = 3;
	}

	/** The handshake finished. */
	public accept(): void {
		this.readyState = 1;
		this.onopen?.();
	}

	/** A frame arrives from the far end. */
	public deliver(body: unknown): void {
		this.onmessage?.({ data: JSON.stringify(body) } as MessageEvent);
	}

	/** A frame arrives that is not text at all. */
	public deliverRaw(data: unknown): void {
		this.onmessage?.({ data } as MessageEvent);
	}

	/** The far end goes away. */
	public drop(): void {
		this.readyState = 3;
		this.onclose?.();
	}

	/** What the application sent, parsed. */
	public frames(): { type: string; payload: Record<string, unknown> }[] {
		return this.sent.map(
			(frame) => JSON.parse(frame) as { type: string; payload: Record<string, unknown> },
		);
	}
}
