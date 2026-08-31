import { createLanka } from "lanka";
import { createLankaHost } from "lanka/config";
import { setLankaRuntimeResolver } from "lanka/internal";
import { lankaServerRuntimeResolver } from "../lanka-server-runtime-resolver/lankaServerRuntimeResolver";
import { lankaServerStorage } from "../lanka-server-storage/lankaServerStorage";
import type { ILankaInstance, TLankaStartConfig } from "lanka";
import type { ILankaServerScopeStore } from "../lanka-server-storage/lankaServerStorage";
import type { TLankaRequestMiddleware } from "lanka/gateway";

let installed = false;

/** Installs the resolver once per process. */
const install = (): void => {
	if (installed) return;
	setLankaRuntimeResolver(lankaServerRuntimeResolver);
	installed = true;
};

/**
 * One unit of server work, against an instance nobody else can see.
 *
 * The shared body of every mode a host framework renders in — a request, a
 * prerendered page, a revalidation. What differs between those is what may be
 * carried IN (a user's headers may cross into an SSR render and may not cross
 * into a build), and that difference lives in the callers rather than here: a
 * mode flag inside this function would be one place deciding two policies.
 */
export const runInLankaServerScope = async <TResult>(
	config: TLankaStartConfig,
	middleware: readonly TLankaRequestMiddleware[],
	work: (lanka: ILankaInstance) => Promise<TResult> | TResult,
): Promise<TResult> => {
	install();

	const store: ILankaServerScopeStore = { runtime: null };

	return lankaServerStorage.run(store, async () => {
		// The two calls `startLanka` makes, written out, because the instance must
		// enter the store BETWEEN them: plugins install and bootstrap runs against
		// ambient facades, and those resolve through the store this line fills.
		const lanka = createLanka({
			host:
				config.host ??
				createLankaHost({ apiBaseUrl: config.apiBaseUrl, ...config.messages }),
			flags: config.flags,
		});
		store.runtime = lanka;

		try {
			// Header forwarding goes on BEFORE the plugins, so it is the outermost
			// wrapper: an auth-refresh plugin that restarts a request must see the
			// forwarded cookie on the second attempt too.
			for (const wrapper of middleware) lanka.useRequestMiddleware(wrapper);
			for (const plugin of config.plugins ?? []) lanka.use(plugin);
			await lanka.bootstrap({ services: config.services, scenarios: config.scenarios });

			return await work(lanka);
		} finally {
			// A server that kept one instance per request alive would keep its
			// scopes, subscriptions and bus with it — a leak measured in requests
			// per second.
			lanka.dispose();
		}
	});
};
