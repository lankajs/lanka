/**
 * A middleware's decision about an event.
 *
 * `"pass"` lets it through. `{ stop }` halts it, naming the reason.
 */
export type TLankaEventBusDecision = "pass" | { stop: string };

/**
 * A bus event interceptor.
 *
 * ## Why the decision is RETURNED rather than expressed by calling `next()`
 *
 * A `(eventType, data, next) => void` shape rests on a convention: call `next`
 * and the event continues, do not and it stops. The second happens SILENTLY — no
 * subscriber runs and nothing is logged or counted, so a mechanism that exists
 * for observability becomes its own blind spot.
 *
 * A returned decision cannot be forgotten: the type demands it, and a stop
 * carries a reason into the bus log.
 *
 * ## How this differs from REQUEST middleware
 *
 * There the `(ctx, next) => …` shape stays, and not by oversight: request
 * middleware must be able to RETRY, which can only be expressed by calling
 * `next` twice. And not calling it there means returning a value instead of a
 * request, which the caller sees. Here, not calling it meant the event vanished.
 */
export type TLankaEventBusMiddleware<T> = (eventType: string, data: T) => TLankaEventBusDecision;
