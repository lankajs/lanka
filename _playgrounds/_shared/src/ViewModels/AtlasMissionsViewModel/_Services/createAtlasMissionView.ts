import { createLankaCollectionView } from "@lankajs/collection";
import type { IAtlasMission } from "../../../Core/Interfaces/IAtlasMission";

/**
 * One list's view: how to read a column, and how to recognise a row.
 *
 * `getId` is what makes `stabilise` do anything at all. Without a way to
 * recognise a row across refetches there is nothing to keep, so the stabiliser
 * answers the input untouched — quietly, which is why "rows still re-render" is
 * the first thing to check here.
 */
export const createAtlasMissionView = () =>
	createLankaCollectionView<IAtlasMission, string>({
		getValue: (mission, field) => mission[field as keyof IAtlasMission],
		getId: (mission) => mission.id,
	});
