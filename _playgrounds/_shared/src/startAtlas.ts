import { AtlasPreferences } from "./Core/Services/AtlasPreferences";
import { createLanka } from "lanka/bootstrap";
import { lankaBootstrapSteps } from "@lankajs/plugin-bootstrap-steps";
import {
	lankaFieldsFromErrorMap,
	lankaHttp,
	lankaMessageFromDetail,
	lankaTokenSessionPolicy,
	lankaUnsafeMethods,
} from "@lankajs/plugin-http";
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

/**
 * The secret these DEMONSTRATIONS key their encrypted storage with.
 *
 * Named rather than inlined so that a reader meets the word before the value. A
 * real application takes this from its build and would never find it in source
 * control — which is the whole of what `@lankajs/storage` refuses to do for you.
 */
const PLAYGROUND_SECRET = "atlas-playground-not-a-real-secret";

export interface IAtlasConfig {
	/** Where the API lives. `http://127.0.0.1:4380/api` in development. */
	apiBaseUrl: string;
	/** Whether this build is a development one. Wired from the host's bundler. */
	isDevelopment?: boolean;
	/**
	 * The secret the encrypted half of storage is keyed with.
	 *
	 * Required rather than defaulted, and that is the package's rule rather than
	 * this file's taste: a shipped fallback secret is the absence of encryption
	 * disguised as its presence. What it buys is worth saying plainly — it is
	 * baked into a build, so it is obfuscation rather than protection against a
	 * script running on the page, and what it does is keep personal data out of
	 * `localStorage` as plain text.
	 *
	 * Optional HERE and nowhere else. `@lankajs/storage` refuses a default
	 * because a shipped one is a lie; these applications are demonstrations whose
	 * "personal data" is the string "Ada", and the default below is named so that
	 * nobody mistakes it for a pattern to copy.
	 */
	storageSecret?: string;
	/** Who to sign in as at start-up. Omit and the application starts signed out. */
	signInAs?: string;
}

/** A started application, and everything a host needs to render it. */
export interface IAtlasApp {
	lanka: ILankaInstance;
	/** What this application remembers between visits, personal and not. */
	preferences: AtlasPreferences;
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
					// Without this the application has a form layer it can never
					// reach. Atlas refuses a body with `{ detail, errors: { field:
					// [message] } }` — the shape Nest, Laravel and Rails all produce —
					// and core reads only the status and the host's sentence, because
					// core cannot know which of the twenty conventions a backend picked.
					//
					// Both readers, because a 422 deserves both answers at once and they
					// are not variants of one: `extractFieldErrors` gives every message
					// an ADDRESS so it can sit under its input, and `extractMessage` is
					// the one sentence for the banner a failure with no address gets.
					errors: {
						extractMessage: lankaMessageFromDetail,
						extractFieldErrors: lankaFieldsFromErrorMap,
					},
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

	/*
	 * What this application remembers between visits, wired HERE so every host
	 * gets it.
	 *
	 * It used to exist and be called by nothing but its own unit test, which is
	 * the shape of a package proved on paper: `@lankajs/storage`'s encrypted twin
	 * hashes the KEY as well as the value, and a claim like that is only worth
	 * anything if an application actually stores something through it.
	 *
	 * Framework-free, like the rest of this file — a preference is a fact about a
	 * person, not about a renderer.
	 */
	const preferences = new AtlasPreferences(config.storageSecret ?? PLAYGROUND_SECRET);

	return {
		lanka,
		preferences,
		session,
		missionGateway: new AtlasMissionGateway(),
		crewGateway: createAtlasCrewGateway(),
		boardGateway: new AtlasBoardGateway(),
		telemetryGateway: createAtlasTelemetryGateway(),
		startup: decided,
	};
};
