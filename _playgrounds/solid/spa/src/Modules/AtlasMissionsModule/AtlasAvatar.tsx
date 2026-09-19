import { atlasAvatarSrc } from "@lanka-playgrounds/_shared";
import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";

export interface IAtlasAvatarProps {
	cache: LankaBlobCachePolicy;
	url: string;
	name: string;
}

/**
 * One crew member's face, from the cache when it is there.
 *
 * `atlasAvatarSrc` is synchronous and final for a URL, and both halves of that
 * are the product. Synchronous, because if the blob is in memory an object URL
 * can be minted on the spot and the first render already has it. Final, because
 * swapping `src` on a mounted image makes the browser discard the decoded frame
 * and decode again — which a person sees as a flicker.
 *
 * So nothing here ever upgrades an image that is already on screen. `warmCache`
 * fetches what was missing for the NEXT mount and the next session, and that is
 * the guarantee rather than a limitation.
 *
 * Solid spells that guarantee for free, and this is the one component here where
 * that is worth saying out loud. A component body runs ONCE, so reading
 * `props.url` in the body — the thing Solid usually warns about — is exactly the
 * behaviour wanted: `src` is decided at mount and no signal can move it again.
 * Written as a getter inside the attribute it would re-run on every read and
 * bring back the flicker the cache exists to remove.
 *
 * The fallback lives in `_shared` rather than in this line, because a `??` in a
 * compiled component is a branch v8 reports as never taken however many scenes
 * render it — and because five components must not disagree about what "already
 * cached" means.
 */
export const AtlasAvatar = (props: IAtlasAvatarProps) => {
	const src = atlasAvatarSrc(props.cache, props.url);
	props.cache.warmCache(props.url);

	return <img src={src} alt={props.name} width={32} height={32} class="atlas-avatar" />;
};
