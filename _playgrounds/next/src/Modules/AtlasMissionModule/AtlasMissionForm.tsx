"use client";

import { useState } from "react";
import { AtlasMissionGateway, createAtlasMissionEditVM } from "@lanka-playgrounds/_shared";
import type { IAtlasMission, IAtlasMissionInput } from "@lanka-playgrounds/_shared";
import type { ILankaFieldError } from "lanka/errors";
import type { JSX } from "react";

export interface IAtlasMissionFormProps {
	mission: IAtlasMission;
}

const useEditVM = createAtlasMissionEditVM(new AtlasMissionGateway());

/** Reads a message off the list by the address it carries, in segments. */
const messageFor = (fields: readonly ILankaFieldError[], name: string): string | undefined =>
	fields.find((field) => field.path[0] === name)?.message;

/**
 * A form on a server-rendered page, and where its values live.
 *
 * **Not in the ViewModel.** A ViewModel is a store created at module level — one
 * per PROCESS, which on a server is one shared by every request — and
 * `hydrateLankaVM` applies once per store. An empty form would survive that; a
 * form pre-filled with somebody's mission would hand the next visitor theirs.
 *
 * So the inputs are `useState` HERE, the ViewModel keeps the SERVER's version,
 * and the two meet in `submit`. The same boundary a form library would give,
 * without one.
 *
 * The form never sees a `LankaError`. It is handed an outcome whose failures
 * already carry an address, because a form has a place per input and a transport
 * failure has no input to belong to.
 */
export const AtlasMissionForm = ({ mission }: IAtlasMissionFormProps): JSX.Element => {
	const { submit, isSubmitting, screenError, serverChangedAt } = useEditVM();
	const [title, setTitle] = useState(mission.title);
	const [fields, setFields] = useState<readonly ILankaFieldError[]>([]);
	const [saved, setSaved] = useState(false);

	const onSubmit = async (): Promise<void> => {
		const values: IAtlasMissionInput = {
			title,
			priority: mission.priority,
			crewId: mission.crewId,
		};
		const outcome = await submit(values);

		setFields(outcome.ok ? [] : outcome.fields);
		setSaved(outcome.ok);
	};

	return (
		<form
			aria-label="Edit mission"
			onSubmit={(event) => {
				event.preventDefault();
				void onSubmit();
			}}
		>
			<input
				aria-label="Title"
				value={title}
				onChange={(event) => setTitle(event.target.value)}
			/>
			{messageFor(fields, "title") !== undefined && (
				<p data-testid="title-error">{messageFor(fields, "title")}</p>
			)}

			{screenError !== null && <p role="alert">{screenError}</p>}
			{saved && <p data-testid="saved">Saved</p>}

			{/*
			 * Somebody ELSE changed this while the form was open. The handler that
			 * heard it replaced the server's version and MARKED it rather than
			 * writing into the fields: resetting automatically erases what is being
			 * typed, and ignoring it hands the person a conflict on save.
			 */}
			{serverChangedAt !== null && (
				<p data-testid="changed-elsewhere">This mission changed — reload to see it.</p>
			)}

			<button type="submit" disabled={isSubmitting}>
				Save
			</button>
		</form>
	);
};
