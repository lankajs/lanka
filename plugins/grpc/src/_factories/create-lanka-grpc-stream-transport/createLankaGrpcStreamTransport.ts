import { LankaGrpcStreamTransport } from "../../lanka-grpc-stream-transport/LankaGrpcStreamTransport";
import type { ILankaGrpcStreamConfig } from "../../lanka-grpc-stream-transport/LankaGrpcStreamTransport";

/**
 * The functional style of `LankaGrpcStreamTransport`: the connection an
 * application builds itself and hands to the plugin.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other. Canon: `skills/parity/SKILL.md`.
 */
export const createLankaGrpcStreamTransport = <TRequest, TMessage>(
	config: ILankaGrpcStreamConfig<TRequest, TMessage>,
): LankaGrpcStreamTransport<TRequest, TMessage> =>
	new LankaGrpcStreamTransport<TRequest, TMessage>(config);
