/**
 * The server, as far as this application can tell.
 *
 * `EventSource` IS the outside world for this package, so it is the one thing
 * stubbed. Everything above it — connection lifecycle, envelope parsing,
 * bridges, the trigger context — is the package's own code running for real.
 */
export class PlaygroundEventSource {
	public static instances: PlaygroundEventSource[] = [];

	public onopen: (() => void) | null = null;
	public onerror: (() => void) | null = null;
	public onmessage: ((event: MessageEvent) => void) | null = null;
	public closed = false;

	private readonly handlers = new Map<string, (event: MessageEvent) => void>();

	public readonly url: string;

	public constructor(url: string) {
		// A parameter property is a runtime construct, and this repository compiles
		// with `erasableSyntaxOnly`: types may not emit code.
		this.url = url;
		PlaygroundEventSource.instances.push(this);
	}

	public addEventListener(type: string, handler: (event: MessageEvent) => void): void {
		this.handlers.set(type, handler);
	}

	public close(): void {
		this.closed = true;
	}

	/** Delivers a message the way an open connection would. */
	public deliver(type: string, data: unknown): void {
		this.handlers.get(type)?.({ data: JSON.stringify(data) } as MessageEvent);
	}
}
