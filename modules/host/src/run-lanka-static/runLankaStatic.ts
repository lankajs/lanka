import { runInLankaServerScope } from "../_internal/run-in-lanka-server-scope/runInLankaServerScope";
import type { ILankaInstance, TLankaStartConfig } from "lanka";

/**
 * What a build-time scope takes: the ordinary configuration, and no identity.
 *
 * `headers` and `forward` are typed as impossible rather than merely absent, so
 * copying a `runLankaRequest` call into a `generateStaticParams` fails at the
 * compiler instead of at the first user who sees somebody else's name on a page.
 */
export type TLankaStaticConfig = TLankaStartConfig & {
	readonly headers?: never;
	readonly forward?: never;
};

/**
 * Runs work that has no user: a prerender, a static page, a revalidation.
 *
 * For SSG (`generateStaticParams`, a prerendered route, a static export) and for
 * ISR — both the timed kind and on-demand revalidation. Nobody is waiting, and
 * more importantly nobody is IDENTIFIED: the output is written once and served to
 * everybody.
 *
 * ```ts
 * export async function generateStaticParams() {
 * 	return runLankaStatic({ apiBaseUrl: process.env.API_URL }, async () => {
 * 		const posts = await lankaGateways.postGateway.published();
 * 		return posts.map((post) => ({ slug: post.slug }));
 * 	});
 * }
 * ```
 *
 * ## Why this is a second name and not a flag
 *
 * Because the two differ in what may cross INTO them. A cookie forwarded during a
 * build bakes one reader's data into a file served to every reader — a data leak
 * that no test catches, because the build succeeds and the page looks right to the
 * person who ran it. A separate name makes the wrong call impossible to write by
 * accident; a boolean makes it a default somebody flips.
 *
 * Everything else — the instance per scope, the ambient facades, the disposal — is
 * the same body as `runLankaRequest`, which is why neither of them re-implements
 * it.
 *
 * ## Revalidation stays the host's
 *
 * `revalidate`, `revalidateTag`, `revalidatePath`, a stale-while-revalidate window
 * — those belong to the framework that owns the cache, and this package ships no
 * second one. lanka fetches when asked; when to ask again is the host's answer.
 */
export const runLankaStatic = async <TResult>(
	config: TLankaStaticConfig,
	work: (lanka: ILankaInstance) => Promise<TResult> | TResult,
): Promise<TResult> => {
	// The types forbid it; JavaScript callers have no types. A build that silently
	// forwarded identity is the one failure here worth refusing outright.
	if ("headers" in config && config.headers !== undefined) {
		throw new Error(
			"runLankaStatic was given headers. Build-time output is served to everybody, " +
				"so a user's cookie must not reach it — use runLankaRequest for work that " +
				"belongs to one caller.",
		);
	}

	return runInLankaServerScope(config, [], work);
};
