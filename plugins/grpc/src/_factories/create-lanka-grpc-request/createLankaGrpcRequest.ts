import { LankaGrpcRequest } from "../../lanka-grpc-request/LankaGrpcRequest";
import type { ILankaGrpcRequestConfig } from "../../lanka-grpc-request/LankaGrpcRequest";

/**
 * The functional style of `LankaGrpcRequest`: the request kind an application
 * hands to a gateway it already has.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other. Canon: `skills/parity/SKILL.md`.
 */
export const createLankaGrpcRequest = <TOptions = RequestInit>(
	config: ILankaGrpcRequestConfig<TOptions> = {},
): LankaGrpcRequest<TOptions> => new LankaGrpcRequest<TOptions>(config);
