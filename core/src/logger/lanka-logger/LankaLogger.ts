import { getLankaFlags } from "../../config/get-lanka-flags/getLankaFlags";
import { TLankaLoggerFn } from "../_types/TLankaLoggerFn";
import { TLankaLoggerFlagValue } from "../_types/TLankaLoggerFlagValue";
import { ILankaLoggerSink } from "../_interfaces/ILankaLoggerSink";
import { TLankaLoggerStyle } from "../_types/TLankaLoggerStyle";
import { TPrinterInternal } from "../_types/TPrinterInternal";
import { TLankaLogMessage } from "../_types/TLankaLogMessage";
import { TLankaLogMessageFactory } from "../_types/TLankaLogMessageFactory";
import { ILankaLoggerConfig } from "../_interfaces/ILankaLoggerConfig";

const noop: TLankaLoggerFn = () => {};

const isProd = (): boolean => getLankaFlags().isProduction ?? false;

const resolveFlagValue = (val: TLankaLoggerFlagValue | undefined): boolean => {
	if (val === undefined) return false;
	return typeof val === "function" ? val() : val;
};

const formatBadgeStyle = (color: string) =>
	`background: ${color}; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;`;

const consoleSink: ILankaLoggerSink = {
	emit: ({ layer, level, style, color, message, args }) => {
		// Bound deliberately. Reading a console method off the object and calling it
		// detached is what `unbound-method` warns about, and it is not merely a
		// lint concern: several environments throw "Illegal invocation" when a
		// console method runs with the wrong `this`.
		const fn = (console[level] ?? console.log).bind(console);
		if (style === "badge") {
			const badgeColor = color ?? "#7f8c8d";
			fn(`%c[${layer}]`, formatBadgeStyle(badgeColor), message, ...args);
			return;
		}
		fn(`[${layer}]`, message, ...args);
	},
};

/** Which environment flag stands behind each built-in printer's flag name. */
const FLAG_KEYS = {
	GATEWAY: "loggerGateway",
	SCENARIO: "loggerScenario",
	VIEWMODEL: "loggerViewModel",
	VIEW: "loggerView",
	BOOTSTRAP: "loggerBootstrap",
	ENABLED: "loggerEnabled",
} as const;

/** The five printers every application gets, and how each is coloured. */
const BUILT_IN_PRINTERS: readonly TPrinterInternal[] = [
	{ key: "printGatewayLog", layer: "GW", color: "#7e501f", level: "log", flag: "GATEWAY" },
	{
		key: "printScenarioLog",
		layer: "SC",
		color: "rgba(225,198,15,0.86)",
		level: "log",
		flag: "SCENARIO",
	},
	{ key: "printViewModelLog", layer: "VM", color: "#1a85d6", level: "log", flag: "VIEWMODEL" },
	{ key: "printViewLog", layer: "UI", color: "#c32222", level: "log", flag: "VIEW" },
	{ key: "printBootstrapLog", layer: "BT", color: "#9b59b6", level: "log", flag: "BOOTSTRAP" },
];

/**
 * Output that is not bound to the console, and is silent in production.
 *
 * The ambient one is `lankaLogger`, and it is what an application and the
 * framework both write: `lankaLogger.printGatewayLog(...)`. The class is here for
 * the reason node exposes `Console` beside `console` — a second logger with its
 * own sinks, flags and printers is a real thing to want, and a test that builds
 * one is not fighting a global.
 *
 * ```ts
 * const audit = new LankaLogger();
 * audit.silent();
 * audit.addSink({ emit: (entry) => rows.push(entry) });
 * ```
 *
 * Every method is a no-op in production, checked per call rather than once at
 * import: a flag flipped at runtime must not be able to start the log.
 */
export class LankaLogger {
	private style: TLankaLoggerStyle = "badge";

	private sinks = new Set<ILankaLoggerSink>([consoleSink]);

	private readonly flags = new Map<string, TLankaLoggerFlagValue>();

	private readonly printers = new Map<string, TPrinterInternal>();

	/** The gateway layer's printer. */
	public readonly printGatewayLog: TLankaLoggerFn;

	/** The scenario layer's printer. */
	public readonly printScenarioLog: TLankaLoggerFn;

	/** The ViewModel layer's printer. */
	public readonly printViewModelLog: TLankaLoggerFn;

	/** The view layer's printer. */
	public readonly printViewLog: TLankaLoggerFn;

	/** The bootstrap sequence's printer. */
	public readonly printBootstrapLog: TLankaLoggerFn;

	public constructor() {
		// Registered outside production only: there is nothing to print from, so
		// there is nothing to hold. The printer callables still exist and answer
		// with silence, so no call site needs a branch.
		if (!isProd()) {
			for (const printer of BUILT_IN_PRINTERS) this.printers.set(printer.key, { ...printer });
		}

		this.printGatewayLog = this.createPrinterFn("printGatewayLog");
		this.printScenarioLog = this.createPrinterFn("printScenarioLog");
		this.printViewModelLog = this.createPrinterFn("printViewModelLog");
		this.printViewLog = this.createPrinterFn("printViewLog");
		this.printBootstrapLog = this.createPrinterFn("printBootstrapLog");
	}

	// ── Global configuration ─────────────────────────────────────────────────

	/**
	 * Enables or silences the WHOLE log, overriding the environment.
	 *
	 * Equivalent to setting the `ENABLED` flag.
	 */
	public setEnabled(value: boolean): void {
		if (isProd()) return;
		this.flags.set("ENABLED", value);
	}

	/** Switches output between badges and plain text. */
	public setStyle(style: TLankaLoggerStyle): void {
		if (isProd()) return;
		this.style = style;
	}

	/**
	 * Goes completely silent by removing the sinks; config and printers remain.
	 *
	 * Output is restored with `resetSinks()` or `addSink()`.
	 */
	public silent(): void {
		if (isProd()) return;
		this.sinks.clear();
	}

	/** Restores the single default sink: the console. */
	public resetSinks(): void {
		if (isProd()) return;
		this.sinks = new Set<ILankaLoggerSink>([consoleSink]);
	}

	public addSink(sink: ILankaLoggerSink): void {
		if (isProd()) return;
		this.sinks.add(sink);
	}

	public removeSink(sink: ILankaLoggerSink): void {
		if (isProd()) return;
		this.sinks.delete(sink);
	}

	// ── Flags, built-in and custom ───────────────────────────────────────────

	/**
	 * Declares a flag the printers use, or overrides an existing one.
	 *
	 * The value may be a boolean or a resolver function — for example one reading
	 * localStorage.
	 */
	public setFlag(flag: string, value: TLankaLoggerFlagValue): void {
		if (isProd()) return;
		this.flags.set(flag, value);
	}

	/** Removes a flag override, falling back to the environment value. */
	public unsetFlag(flag: string): void {
		if (isProd()) return;
		this.flags.delete(flag);
	}

	public isFlagEnabled(flag: string): boolean {
		if (isProd()) return false;

		const runtimeFlag = this.flags.get(flag);
		if (runtimeFlag !== undefined) return resolveFlagValue(runtimeFlag);

		const flags = getLankaFlags();
		const key = FLAG_KEYS[flag as keyof typeof FLAG_KEYS];
		if (key && flags[key] !== undefined) return flags[key] ?? false;

		return false;
	}

	// ── Printers, built-in and custom ────────────────────────────────────────

	/**
	 * Registers a printer, or replaces an existing one.
	 *
	 * @returns The callable bound to this printer
	 */
	public registerPrinter(config: ILankaLoggerConfig): TLankaLoggerFn {
		if (isProd()) return noop;

		this.printers.set(config.key, {
			key: config.key,
			layer: config.layer,
			color: config.color,
			level: config.level ?? "log",
			flag: config.flag,
			enabled: config.enabled,
		});

		return this.createPrinterFn(config.key);
	}

	/** Updates a printer's config; a no-op when there is no such printer. */
	public updatePrinter(key: string, patch: Partial<Omit<ILankaLoggerConfig, "key">>): void {
		if (isProd()) return;

		const existing = this.printers.get(key);
		if (!existing) return;

		// Every field defended, not two of five: a patch says what to change, and a
		// key it did not mention — or mentioned as `undefined` — must keep its value.
		this.printers.set(key, {
			key,
			layer: patch.layer ?? existing.layer,
			color: patch.color ?? existing.color,
			level: patch.level ?? existing.level,
			flag: patch.flag ?? existing.flag,
			enabled: patch.enabled ?? existing.enabled,
		});
	}

	/** A printer by key; a silent function when there is none. */
	public getPrinter(key: string): TLankaLoggerFn {
		if (isProd()) return noop;
		return this.printers.has(key) ? this.createPrinterFn(key) : noop;
	}

	/** The keys of every registered printer. */
	public listPrinters(): string[] {
		if (isProd()) return [];
		return Array.from(this.printers.keys());
	}

	// ── The path a message takes ─────────────────────────────────────────────

	private isEnabled(): boolean {
		if (isProd()) return false;

		const runtimeFlag = this.flags.get("ENABLED");
		if (runtimeFlag !== undefined) return resolveFlagValue(runtimeFlag);

		return getLankaFlags().loggerEnabled ?? false;
	}

	private isPrinterEnabled(printer: TPrinterInternal): boolean {
		if (isProd()) return false;
		if (!this.isEnabled()) return false;
		if (printer.enabled !== undefined) return resolveFlagValue(printer.enabled);
		if (printer.flag) return this.isFlagEnabled(printer.flag);

		return true;
	}

	private emit(
		printer: TPrinterInternal,
		msg: TLankaLogMessage | TLankaLogMessageFactory,
		args: unknown[],
	): void {
		if (isProd() || !this.isPrinterEnabled(printer)) return;

		// Annotated, not inferred: `TLankaLogMessage` admits `object`, and a
		// function IS an object, so narrowing this union by `typeof` leaves the
		// call's result wider than the union it came from.
		const message: TLankaLogMessage =
			typeof msg === "function" ? (msg as TLankaLogMessageFactory)() : msg;

		for (const sink of this.sinks) {
			sink.emit({
				layer: printer.layer,
				level: printer.level,
				style: this.style,
				color: printer.color,
				message,
				args,
			});
		}
	}

	/**
	 * A printer resolved at CALL time, not at registration.
	 *
	 * `updatePrinter` has to reach a callable a screen took a reference to long
	 * before; looking the key up on every call is what makes that true.
	 */
	private createPrinterFn(key: string): TLankaLoggerFn {
		if (isProd()) return noop;

		return (msg, ...args) => {
			const printer = this.printers.get(key);
			if (!printer) return;

			this.emit(printer, msg, args);
		};
	}
}

/**
 * The logger the framework itself writes to, and an application with it.
 *
 * `console` to this file's `Console`: ready before anything is configured, and
 * the one every call site in the framework uses.
 */
export const lankaLogger = new LankaLogger();
