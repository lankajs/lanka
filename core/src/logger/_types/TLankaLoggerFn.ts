import type { TLankaLogMessage } from "./TLankaLogMessage";
import type { TLankaLogMessageFactory } from "./TLankaLogMessageFactory";

export type TLankaLoggerFn = (
	msg: TLankaLogMessage | TLankaLogMessageFactory,
	...args: unknown[]
) => void;
