import type { ILankaFlags } from "./ILankaFlags";
import type { ILankaHost } from "./ILankaHost";

export interface ILankaRuntimeConfig {
	flags?: ILankaFlags;
	host?: ILankaHost;
}
