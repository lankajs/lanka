import type { IPlaygroundProfileAudit } from "../_interfaces/IPlaygroundProfileAudit";

/**
 * The real one, which a test replaces.
 *
 * An application resolves it by name rather than importing it, which is the
 * whole reason a double can stand in its place without the screen knowing.
 */
export class PlaygroundProfileAudit implements IPlaygroundProfileAudit {
	private readonly seen: string[] = [];

	public get recorded(): readonly string[] {
		return this.seen;
	}

	public record(name: string): void {
		this.seen.push(name);
	}
}
