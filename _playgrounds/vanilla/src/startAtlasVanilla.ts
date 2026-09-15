import { lankaSse } from "@lankajs/plugin-sse";
import { startAtlas } from "@lanka-playgrounds/_shared";
import type { IAtlasApp } from "@lanka-playgrounds/_shared";

export interface IAtlasVanillaConfig {
	apiBaseUrl: string;
	/** Whether to open the stream. Off in a test that does not want one. */
	connect?: boolean;
	isDevelopment?: boolean;
}

/** Atlas, plus the one connection this application opens. */
export interface IAtlasVanilla {
	app: IAtlasApp;
	stop: () => void;
}

/**
 * Start-up with no framework anywhere in it.
 *
 * `startAtlas` is the half four other applications share, and this file is what
 * is left over for THIS host — which is one plugin. The React application's
 * equivalent installs five, a read cache and a socket; the difference between
 * the two files is the difference between the hosts, which is the whole reason
 * they are separate files.
 *
 * What is NOT here is the point: no provider, no root component, no renderer.
 * Nothing in `lanka` asks for one.
 */
export const startAtlasVanilla = async (config: IAtlasVanillaConfig): Promise<IAtlasVanilla> => {
	const app = await startAtlas({
		apiBaseUrl: config.apiBaseUrl,
		isDevelopment: config.isDevelopment,
		signInAs: "Ada",
	});

	const sse = lankaSse({ path: "/sse/events" });
	app.lanka.use(sse);

	// Not on install, deliberately. A stream is opened for an AUTHENTICATED user,
	// and when that happens is the application's knowledge.
	if (config.connect !== false) sse.sse.connect();

	return {
		app,
		stop: () => {
			sse.sse.disconnect();
			app.lanka.dispose();
		},
	};
};
