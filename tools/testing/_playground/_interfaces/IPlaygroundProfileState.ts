import type { IPlaygroundProfile } from "./IPlaygroundProfile";

/** What that application's screen reads. */
export interface IPlaygroundProfileState {
	profile: IPlaygroundProfile | null;
	error: string | null;
}
