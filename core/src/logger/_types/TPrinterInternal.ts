import type { TLankaConsoleLevel } from "./TLankaConsoleLevel";
import type { ILankaLoggerConfig } from "../_interfaces/ILankaLoggerConfig";
import type { TLankaLoggerFlagValue } from "./TLankaLoggerFlagValue";

export type TPrinterInternal = Required<Pick<ILankaLoggerConfig, "key" | "layer">> &
	Pick<ILankaLoggerConfig, "color" | "flag"> & {
		level: TLankaConsoleLevel;
		enabled?: TLankaLoggerFlagValue;
	};
