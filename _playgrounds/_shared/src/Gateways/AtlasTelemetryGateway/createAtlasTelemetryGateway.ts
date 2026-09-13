import { createLankaGrpcGateway, createLankaGrpcJsonCodec } from "@lankajs/plugin-grpc";
import type { ILankaGrpcMethod } from "@lankajs/plugin-grpc";

/** What the board's telemetry answers. */
export interface IAtlasTelemetry {
	queued: number;
	active: number;
	done: number;
}

/** What the telemetry gateway offers. */
export interface IAtlasTelemetryGateway {
	summary: () => Promise<IAtlasTelemetry>;
	/** A call the server refuses on purpose, so a refusal can be seen arriving. */
	restricted: () => Promise<IAtlasTelemetry>;
}

/**
 * The method, written as the server declares it.
 *
 * One string copied from the `.proto` rather than a package name, a service name
 * and a method name joined here: three fields to get wrong against one that is
 * checkable by eye.
 */
const SUMMARY: ILankaGrpcMethod<Record<string, never>, IAtlasTelemetry> = {
	path: "/atlas.v1.Board/Summary",
	codec: createLankaGrpcJsonCodec<Record<string, never>, IAtlasTelemetry>(),
};

const RESTRICTED: ILankaGrpcMethod<Record<string, never>, IAtlasTelemetry> = {
	path: "/atlas.v1.Board/Restricted",
	codec: createLankaGrpcJsonCodec<Record<string, never>, IAtlasTelemetry>(),
};

/**
 * Telemetry over gRPC-Web, with the JSON codec.
 *
 * The codec is the application's, always — it belongs to whatever generated the
 * message types, and a framework that shipped one would be choosing a code
 * generator on everybody's behalf. `createLankaGrpcJsonCodec` is the exception
 * that proves it: a codec for a server speaking `application/grpc-web+json`,
 * which is also the one whose wire a person can read while debugging.
 *
 * `contentType` has to be said out loud with it. The default is
 * `application/grpc-web+proto`, and a default that silently sent JSON would fail
 * as a decoding error inside somebody's server.
 */
export const createAtlasTelemetryGateway = (): IAtlasTelemetryGateway =>
	createLankaGrpcGateway<IAtlasTelemetryGateway>({
		basePath: "/grpc",
		contentType: "application/grpc-web+json",
		methods: ({ unary }) => ({
			summary: () => unary(SUMMARY, {}),
			restricted: () => unary(RESTRICTED, {}),
		}),
	});
