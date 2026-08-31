import type { TLankaConsoleLevel } from "../_types/TLankaConsoleLevel";
import type { TLankaLoggerStyle } from "../_types/TLankaLoggerStyle";
import type { TLankaLogMessage } from "../_types/TLankaLogMessage";

export interface ILankaLoggerSink {
	emit: (entry: {
		layer: string;
		level: TLankaConsoleLevel;
		style: TLankaLoggerStyle;
		color?: string;
		message: TLankaLogMessage;
		args: unknown[];
	}) => void;
}
