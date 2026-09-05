import type { ILankaPlugin } from "lanka";
import {
	lankaStream,
	type ALankaStreamBridge,
	type ILankaServerEventTransport,
	type ILankaStreamTriggerContext,
} from "lanka/stream";
import {
	LankaGraphqlSubscriptionTransport,
	type ILankaGraphqlSubscriptionConfig,
} from "../lanka-graphql-subscription-transport/LankaGraphqlSubscriptionTransport";

export interface ILankaGraphqlPluginConfig extends ILankaGraphqlSubscriptionConfig {
	/**
	 * The application's bridges, created by it — the package knows no event type.
	 *
	 * A factory rather than ready objects: a bridge needs the connection and the
	 * "from outside" marker, and both belong to THIS plugin installation.
	 */
	bridges?: (context: {
		subscriptions: ILankaServerEventTransport;
		trigger: ILankaStreamTriggerContext;
	}) => readonly ALankaStreamBridge[];
	/**
	 * A connection this application supplies instead of the default one.
	 *
	 * The usual reason is a backend whose subscriptions are not `graphql-ws` at
	 * all: SSE over `text/event-stream`, or a socket the application already has.
	 * Bridges above cannot tell.
	 */
	transport?: ILankaServerEventTransport;
	/**
	 * Connect as soon as the plugin is registered. Off by default.
	 *
	 * Deliberately off: a subscription is opened for an AUTHENTICATED user, and
	 * when that happens is the application's knowledge. A plugin that connected by
	 * itself would open a socket on the sign-in screen and present no token.
	 */
	connectOnInstall?: boolean;
}

export interface ILankaGraphqlPlugin extends ILankaPlugin {
	/** The subscription connection: subscribe, connect, disconnect. */
	readonly subscriptions: ILankaServerEventTransport;
	/** The "this change came from the server" marker. */
	readonly trigger: ILankaStreamTriggerContext;
}

/**
 * GraphQL subscriptions wired into the framework's lifetime.
 *
 * ## Only subscriptions
 *
 * Queries and mutations need no plugin and no `use()`: they are ordinary
 * requests, and `ALankaGraphqlGateway` or `createLankaGraphqlRequest` is the
 * whole of it. A plugin exists here because a SUBSCRIPTION is a connection, and
 * a connection needs a lifetime to belong to — opened when a session exists,
 * closed when the instance is disposed, with the bridges detached first.
 *
 * An application using GraphQL without subscriptions never installs this and
 * loses nothing.
 */
export const lankaGraphql = (config: ILankaGraphqlPluginConfig = {}): ILankaGraphqlPlugin => {
	const subscriptions = config.transport ?? new LankaGraphqlSubscriptionTransport(config);

	const stream = lankaStream({
		name: "@lankajs/plugin-graphql",
		transport: subscriptions,
		connectOnInstall: config.connectOnInstall,
		bridges: ({ trigger }) => config.bridges?.({ subscriptions, trigger }) ?? [],
	});

	return {
		name: stream.name,
		subscriptions,
		trigger: stream.trigger,
		install: stream.install,
	};
};
