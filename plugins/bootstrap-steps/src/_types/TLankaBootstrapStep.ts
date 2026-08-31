/**
 * A pipeline step: receives a context, returns the next one.
 *
 * The context is TYPED by the application: every app gathers different things at
 * startup, and a shared string-keyed bag would remove the whole value.
 */
export type TLankaBootstrapStep<TContext> = (context: TContext) => TContext | Promise<TContext>;

/*
 * A step RETURNS a new context instead of writing into the one it received.
 *
 * A rule rather than a check: guarding against writes would cost a deep copy per
 * step. It exists so a failed step leaves no half-result behind — and only what
 * was returned can be discarded.
 */
