import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { renderLankaDevtoolsPanel } from "@lankajs/plugin-devtools";
import { setLankaStorageSecret } from "@lankajs/storage";
import { AtlasApp } from "./App/AtlasApp";
import { createAtlasAvatarCache } from "./Core/Services/createAtlasAvatarCache";
import { createAtlasReleaseGuard } from "./Core/Services/createAtlasReleaseGuard";
import { startAtlasBrowser } from "./startAtlasBrowser";

/**
 * The entry point: start, then render, and nothing else in the file.
 *
 * Every line here is ordered on purpose.
 *
 * `setLankaStorageSecret` comes FIRST, before anything can read or write: the
 * storage has no default secret and refuses loudly without one, because a
 * shipped fallback secret is the absence of encryption disguised as its
 * presence.
 *
 * The release guard runs before the first screen, and its answer is READ rather
 * than acted on. A reload would be the commonest response and the worst
 * default — somebody halfway through a dispatch would lose it — so this
 * application writes a line and moves on.
 *
 * `hydrate()` on the avatar cache is before the first render, or the first
 * render takes the network path and the cache appears not to work.
 */
const apiBaseUrl = import.meta.env.VITE_ATLAS_API ?? "http://127.0.0.1:4380/api";

setLankaStorageSecret(import.meta.env.VITE_ATLAS_SECRET ?? "atlas-playground-secret");

const guard = createAtlasReleaseGuard(apiBaseUrl, {
	report: (message) => console.info(message),
});
const released = await guard.check();

const avatars = createAtlasAvatarCache();
await avatars.hydrate();

const browser = await startAtlasBrowser({
	apiBaseUrl,
	isDevelopment: import.meta.env.DEV,
});

const root = document.getElementById("root");
if (root === null) throw new Error("Atlas has nowhere to render: #root is missing");

createRoot(root).render(
	<StrictMode>
		<AtlasApp browser={browser} avatars={avatars} />
	</StrictMode>,
);

console.info(`atlas started: release ${released}, avatars on ${avatars.getBackend()}`);

// In a production build this does nothing and returns before any work: a panel
// there is not a little extra code, it is an interface that can appear on
// somebody's screen.
renderLankaDevtoolsPanel(
	() =>
		(
			globalThis as { __atlas?: { getSnapshot: () => unknown } }
		).__atlas?.getSnapshot() as never,
	{},
);
