/**
 * Output not bound to the console.
 *
 * `ILankaLoggerSink` is the extension point: the console sink is one of many, and
 * `@lankajs/plugin-devtools` attaches here.
 */

export { LankaLogger } from "./lanka-logger/LankaLogger";
export { lankaLogger } from "./lanka-logger/LankaLogger";
export type { ILankaLoggerConfig } from "./_interfaces/ILankaLoggerConfig";
export type { ILankaLoggerSink } from "./_interfaces/ILankaLoggerSink";
export type { TLankaConsoleLevel } from "./_types/TLankaConsoleLevel";
export type { TLankaLogMessage } from "./_types/TLankaLogMessage";
export type { TLankaLogMessageFactory } from "./_types/TLankaLogMessageFactory";
export type { TLankaLoggerFlagValue } from "./_types/TLankaLoggerFlagValue";
export type { TLankaLoggerFn } from "./_types/TLankaLoggerFn";
export type { TLankaLoggerStyle } from "./_types/TLankaLoggerStyle";
