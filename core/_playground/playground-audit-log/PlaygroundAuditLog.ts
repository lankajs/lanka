import { defineLankaRole } from "../../src/role/index";
import type { ILankaRoleOpening } from "../../src/role/index";

/** What an application configures about its own audit log. */
export interface IPlaygroundAuditConfig {
	/** Written before every entry. Empty by default. */
	prefix?: string;
}

/** What every audit log can do, whichever style wrote it. */
export interface IPlaygroundAuditContext {
	record: (what: string) => void;
	entries: () => readonly string[];
}

/**
 * A layer the APPLICATION invented, not the framework.
 *
 * The point of the scene: an application with a role of its own — an audit log,
 * a repository, a presenter — gets both styles for it from one line, under the
 * same rules the framework's own roles follow. The same option reaches both.
 */
export abstract class APlaygroundAuditLog {
	private readonly recorded: string[] = [];
	protected readonly prefix: string;

	protected constructor(config: IPlaygroundAuditConfig = {}) {
		this.prefix = config.prefix ?? "";
	}

	/** The protected surface: what a subclass builds on, and what a factory gets. */
	protected record(what: string): void {
		this.recorded.push(`${this.prefix}${what}`);
	}

	protected entries(): readonly string[] {
		return this.recorded;
	}
}

/**
 * The opener, in the role's own module.
 *
 * Here and only here, because the language reads `protected` from inside a
 * deriving class body and nowhere else.
 */
class PlaygroundAuditBridge extends APlaygroundAuditLog {
	public constructor(config: IPlaygroundAuditConfig) {
		super(config);
	}

	public open(): ILankaRoleOpening<APlaygroundAuditLog, IPlaygroundAuditContext> {
		return {
			instance: this,
			context: {
				record: (what) => {
					this.record(what);
				},
				entries: () => this.entries(),
			},
		};
	}
}

export const createPlaygroundAuditLog = defineLankaRole<
	IPlaygroundAuditConfig,
	APlaygroundAuditLog,
	IPlaygroundAuditContext
>((config) => new PlaygroundAuditBridge(config).open());
