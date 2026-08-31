import { TLankaPollingCallback } from "../_types/TLankaPollingCallback";

export interface ILankaPollingConfig<T = unknown> {
	id: string;
	callback: TLankaPollingCallback<T>;
	intervalMs: number;
	initialDelayMs: number;
}
