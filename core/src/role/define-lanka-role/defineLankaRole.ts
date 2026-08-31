/** What a role's bridge hands over: the instance, and its protected surface. */
export interface ILankaRoleOpening<TInstance, TContext> {
	instance: TInstance;
	context: TContext;
}

/**
 * Builds a role's instance and opens its protected surface.
 *
 * Written in the role's own module, because that is the only place the language
 * allows: `protected` is readable from inside a class body deriving from the
 * base and nowhere else. A generic helper cannot reach it, and a base that made
 * it public would put its whole extension surface on every object a consumer
 * writes.
 */
export type TLankaRoleOpener<TConfig, TInstance, TContext> = (
	config: TConfig,
) => ILankaRoleOpening<TInstance, TContext>;

/**
 * The functional style of one role: call it with hooks, or with nothing.
 *
 * With `build` it answers what the hooks returned — the methods a gateway
 * declares, the actions a ViewModel exposes. Without it, the instance itself,
 * which is what a role whose whole body is data needs.
 */
export interface ILankaRoleFactory<TConfig, TInstance, TContext> {
	<TResult>(config: TConfig & { build: (context: TContext) => TResult }): TResult;
	(config: TConfig): TInstance;
}

/**
 * Turns a role's class into its factory, over one implementation.
 *
 * The two styles of a role are not two implementations: the factory builds the
 * SAME class and hands its protected surface to the caller as an object. A
 * behaviour fix lands in both styles at once, and a divergence is not something
 * a reviewer has to notice — it cannot be written.
 *
 * It is published because a consumer with a layer of their own — a repository, a
 * command, a presenter — gets both styles for it from one line:
 *
 * ```ts
 * export const createRepository = defineLankaRole(openRepository);
 * ```
 *
 * Canon: `skills/parity/SKILL.md`.
 */
export const defineLankaRole = <TConfig, TInstance, TContext>(
	open: TLankaRoleOpener<TConfig, TInstance, TContext>,
): ILankaRoleFactory<TConfig, TInstance, TContext> =>
	((config: TConfig & { build?: (context: TContext) => unknown }) => {
		const opened = open(config);

		return config.build ? config.build(opened.context) : opened.instance;
	}) as ILankaRoleFactory<TConfig, TInstance, TContext>;
