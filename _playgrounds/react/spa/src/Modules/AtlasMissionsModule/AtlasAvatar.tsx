import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";
import type { JSX } from "react";

export interface IAtlasAvatarProps {
	cache: LankaBlobCachePolicy;
	url: string;
	name: string;
}

/**
 * One crew member's face, from the cache when it is there.
 *
 * `getInitialSrc` is SYNCHRONOUS and final for a URL, and both halves of that
 * are the product. Synchronous, because if the blob is in memory an object URL
 * can be minted on the spot and the first render already has it. Final, because
 * swapping `src` on a mounted image makes the browser discard the decoded frame
 * and decode again — which a person sees as a flicker.
 *
 * So nothing here ever upgrades an image that is already on screen. `warmCache`
 * fetches what was missing for the NEXT mount and the next session, and that is
 * the guarantee rather than a limitation.
 */
export const AtlasAvatar = ({ cache, url, name }: IAtlasAvatarProps): JSX.Element => {
	const src = cache.getInitialSrc(url) ?? url;
	cache.warmCache(url);

	return <img src={src} alt={name} width={32} height={32} className="atlas-avatar" />;
};
