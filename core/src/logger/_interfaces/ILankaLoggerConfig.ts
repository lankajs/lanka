import type { TLankaConsoleLevel } from "../_types/TLankaConsoleLevel";
import type { TLankaLoggerFlagValue } from "../_types/TLankaLoggerFlagValue";

export interface ILankaLoggerConfig {
	/**
	 * Unique printer key, used for later updates / retrieval.
	 * Example: "printGatewayLog" or "printMyFeatureLog"
	 */
	key: string;
	/**
	 * Short label for the log prefix.
	 * Example: "GW" / "SC" / "VM" / "MOD" / "MY"
	 */
	layer: string;
	/**
	 * Optional badge color (used in "badge" style).
	 */
	color?: string;
	/**
	 * Console level (log/info/warn/error/debug).
	 */
	level?: TLankaConsoleLevel;
	/**
	 * If provided, printer is enabled only when the flag is enabled.
	 */
	flag?: string;
	/**
	 * Hard enable/disable of the printer (has priority over `flag`).
	 */
	enabled?: TLankaLoggerFlagValue;
}
