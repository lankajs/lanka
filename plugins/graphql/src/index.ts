/**
 * @lankajs/plugin-graphql — operations, and subscriptions.
 *
 * A plugin, not a module — but only half of it is. Queries and mutations are
 * ordinary requests and need no `use()`; a SUBSCRIPTION is a connection, and a
 * connection needs a lifetime to belong to. So `lankaGraphql` sits on the path
 * core walks and the rest is reached by importing it.
 *
 * ## The one thing this package is really for
 *
 * **GraphQL answers `200 OK` with an `errors` array.** Through an ordinary JSON
 * request that is a success carrying a body the screen then has to inspect, so
 * every application grows the same helper — and the ones that forget show a
 * spinner over a failed mutation. `LankaGraphqlRequest` turns it into
 * `LankaError` with `kind: "domain"`, which is the kind the framework already
 * has for a server refusing deliberately and naming the reason.
 *
 * ## What will NOT appear here
 *
 * A client. No cache, no normalisation, no fragment registry, no document
 * parser: a ViewModel already owns the state a screen reads, and a build-time
 * code generator already knows more about the schema than a runtime parser can.
 */

export { lankaGraphql } from "./lanka-graphql/lankaGraphql";
export type { ILankaGraphqlPlugin, ILankaGraphqlPluginConfig } from "./lanka-graphql/lankaGraphql";

export { LankaGraphqlRequest } from "./lanka-graphql-request/LankaGraphqlRequest";
export { createLankaGraphqlRequest } from "./_factories/create-lanka-graphql-request/createLankaGraphqlRequest";
export type {
	ILankaGraphqlError,
	ILankaGraphqlRequestConfig,
} from "./lanka-graphql-request/LankaGraphqlRequest";

export { ALankaGraphqlGateway } from "./_abstractions/lanka-graphql-gateway/ALankaGraphqlGateway";
export { createLankaGraphqlGateway } from "./_factories/create-lanka-graphql-gateway/createLankaGraphqlGateway";
export type { IALankaGraphqlGatewayConfig } from "./_abstractions/lanka-graphql-gateway/ALankaGraphqlGateway";
export type { ILankaGraphqlGatewayConfig } from "./_factories/create-lanka-graphql-gateway/createLankaGraphqlGateway";
export type { ILankaGraphqlGatewayContext } from "./_interfaces/ILankaGraphqlGatewayContext";
export type { ILankaGraphqlOperation } from "./_interfaces/ILankaGraphqlOperation";

export { LankaGraphqlSubscriptionTransport } from "./lanka-graphql-subscription-transport/LankaGraphqlSubscriptionTransport";
export { createLankaGraphqlSubscriptionTransport } from "./_factories/create-lanka-graphql-subscription-transport/createLankaGraphqlSubscriptionTransport";
export type {
	ILankaGraphqlSocketEvents,
	ILankaGraphqlSubscriptionConfig,
	ILankaGraphqlSubscriptionSocket,
	TLankaGraphqlSocketOpener,
} from "./lanka-graphql-subscription-transport/LankaGraphqlSubscriptionTransport";

export { readLankaGraphqlDocument } from "./read-lanka-graphql-document/readLankaGraphqlDocument";

/*
 * The protocol-free half, re-exported so a GraphQL application has one import.
 *
 * The implementations live in `lanka/stream` and must not be forked here: the
 * "from outside" marker is the one piece whose failure is silent, and two copies
 * of it would be two chances to get it wrong once.
 */
export { ALankaStreamBridge, createLankaStreamBridge } from "lanka/stream";
export type {
	ILankaServerEventTransport,
	ILankaStreamBridgeContext,
	ILankaStreamTriggerContext,
} from "lanka/stream";
