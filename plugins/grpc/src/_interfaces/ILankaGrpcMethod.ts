import type { ILankaGrpcCodec } from "./ILankaGrpcCodec";

/**
 * One RPC: where it lives, and how its messages are encoded.
 *
 * `path` is the gRPC name — `/package.Service/Method` — written as the server
 * declares it rather than assembled from parts here. A package name, a service
 * name and a method name joined by this code would be three fields to get
 * wrong; the one string is copied from the `.proto` and is checkable by eye.
 */
export interface ILankaGrpcMethod<TRequest, TResponse> {
	path: string;
	codec: ILankaGrpcCodec<TRequest, TResponse>;
}
