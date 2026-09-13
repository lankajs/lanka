import { createLanka } from "lanka/bootstrap";
import { lankaBootstrapSteps } from "@lankajs/plugin-bootstrap-steps";
import { lankaHttp, lankaTokenSessionPolicy, lankaUnsafeMethods } from "@lankajs/plugin-http";
import { AtlasMissionGateway } from "./Gateways/AtlasMissionGateway/AtlasMissionGateway";
import { AtlasSessionGateway } from "./Gateways/AtlasSessionGateway/AtlasSessionGateway";
import { AtlasBoardGateway } from "./Gateways/AtlasBoardGateway/AtlasBoardGateway";
import { AtlasSession } from "./Core/Singletons/AtlasSession/AtlasSession";
import { createAtlasHost } from "./Core/Configs/createAtlasHost";
import { createAtlasCrewGateway } from "./Gateways/AtlasCrewGateway/createAtlasCrewGateway";
import { createAtlasStartupSteps } from "./Core/Configs/createAtlasStartupSteps";
import { createAtlasTelemetryGateway } from "./Gateways/AtlasTelemetryGateway/createAtlasTelemetryGateway";
import type { IAtlasCrewGateway } from "./Gateways/AtlasCrewGateway/createAtlasCrewGateway";
import type { IAtlasStartupContext } from "./Core/Configs/createAtlasStartupSteps";
import type { IAtlasTelemetryGateway } from "./Gateways/AtlasTelemetryGateway/createAtlasTelemetryGateway";
import type { ILankaInstance } from "lanka/bootstrap";

export interface IAtlasConfig {
	/** Where the API lives. `http://127.0.0.1:4380/api` in development. */
	apiBaseUrl: string;
	/** Whether this build is a development one. Wired from the host's bundler. */
	isDevelopment?: boolean;
	/** Who to sign in as at start-up. Omit and the application starts signed out. */
	signInAs?: string;
}

/** A started application, and everything a host needs to render it. */
export interface IAtlasApp {
	lanka: ILankaInstance;
	session: AtlasSession;
	missionGateway: AtlasMissionGateway;
	crewGateway: IAtlasCrewGateway;
	boardGateway: AtlasBoardGateway;
	telemetryGateway: IAtlasTelemetryGateway;
	/** What the start-up chain decided, including where to send the user. */
	startup: IAtlasStartupContext;
}

/**
 * The whole start-up, in one file, and nothing else in it.
 *
 * Written as `createLanka` + `bootstrap` rather than `startLanka`, because
 * something has to happen BETWEEN the two: the session service is registered
 * before bootstrap runs, and the request policy asks that service to refresh. A
 * one-line start cannot express an order.
 *
 * Three things are worth reading closely:
 *
 * **`refreshAuth` is a function, not a URL.** Refreshing goes through the
 * application layer, which knows the route, the headers it needs and what to do
 * with the answer. A plugin that knew the endpoint would have to know the
 * response shape and the session storage too, and would stop being a request
 * policy.
 *
 * **`shouldSkip` keeps the refresh out of its own ladder.** Without it a 401 on
 * the refresh route refreshes, which 401s, which refreshes.
 *
 * **The idempotency header is named.** The default is `x-idempotency-key` and
 * this backend reads `idempotency-key`; a retry whose key the server does not
 * recognise creates a second mission, which is the exact failure the key exists
 * to prevent.
 */
export const startAtlas = async (config: IAtlasConfig): Promise<IAtlasApp> => {
	const lanka = createLanka({
		host: createAtlasHost(config.apiBaseUrl),
		flags: { isDevelopment: config.isDevelopment ?? false },
	});

	const sessionGateway = new AtlasSessionGateway();
	const session = new AtlasSession(sessionGateway);

	// `registerInstance`, not `register`: the locator builds a class with no
	// arguments, and this one is given a gateway. A default would let a second
	// session service exist without anybody noticing.
	lanka.locators.singletons.registerInstance("AtlasSession", session);

	lanka.use(
		lankaHttp(
			lankaTokenSessionPolicy({
				auth: {
					refreshAuth: () => session.renew(),
					shouldSkip: (endpoint) => endpoint.includes("/session"),
					onRefreshFailed: () => session.signOut("expired"),
				},
				defaults: {
					// Read once per ATTEMPT, so a retry after a refresh carries the new
					// token rather than the one that had just expired.
					headers: () => {
						const token = session.token();

						return {
							"x-atlas-client": "playground",
							...(token === null ? {} : { authorization: `Bearer ${token}` }),
						};
					},
				},
				overrides: {
					idempotency: { header: "idempotency-key", methods: lankaUnsafeMethods },
				},
			}),
		),
	);

	const startup = lankaBootstrapSteps<IAtlasStartupContext>(
		createAtlasStartupSteps(session, config.signInAs),
	);
	lanka.use(startup);

	await lanka.bootstrap();
	const decided = await startup.pipeline.run();

	return {
		lanka,
		session,
		missionGateway: new AtlasMissionGateway(),
		crewGateway: createAtlasCrewGateway(),
		boardGateway: new AtlasBoardGateway(),
		telemetryGateway: createAtlasTelemetryGateway(),
		startup: decided,
	};
};
