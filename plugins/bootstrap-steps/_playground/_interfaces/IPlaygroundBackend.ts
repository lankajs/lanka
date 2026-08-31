/**
 * The world the start-up sequence runs against, stated as data.
 *
 * Every scene a test needs is one of these objects, so a new scene is a new
 * literal rather than a new mock.
 */
export interface IPlaygroundBackend {
	token: string | null;
	profileFails?: boolean;
	analyticsFails?: boolean;
	analyticsDelayMs?: number;
}
