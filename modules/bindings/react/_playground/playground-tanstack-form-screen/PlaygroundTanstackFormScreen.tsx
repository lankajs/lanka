import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { playgroundOrderInputSchema } from "../playground-order-input-schema/playgroundOrderInputSchema";
import { toPlaygroundTanstackErrors } from "../to-playground-tanstack-errors/toPlaygroundTanstackErrors";
import type { IPlaygroundFormScreenProps } from "../_interfaces/IPlaygroundFormScreenProps";

/** What a field's errors say — a Standard Schema issue, or a string, either way. */
const messagesOf = (errors: readonly unknown[]): string[] =>
	errors.flatMap((error) => {
		if (typeof error === "string") return [error];
		if (typeof error === "object" && error !== null && "message" in error) {
			return [String(error.message)];
		}
		return [];
	});

/**
 * The edit form on TanStack Form.
 *
 * The application's Standard Schema goes straight into `validators.onSubmit`:
 * this library reads the protocol itself, so there is no resolver to write. The
 * server's answer takes the road the library documents for it — an asynchronous
 * submit validator that returns `{ form, fields }`, assembled by
 * `toPlaygroundTanstackErrors`.
 */
export const PlaygroundTanstackFormScreen = ({ initial, submit }: IPlaygroundFormScreenProps) => {
	const [savedVersion, setSavedVersion] = useState<number | null>(null);

	const form = useForm({
		defaultValues: initial,
		validators: {
			onSubmit: playgroundOrderInputSchema,
			onSubmitAsync: async ({ value }) => {
				const outcome = await submit(value);
				if (outcome.ok) {
					setSavedVersion(outcome.data.updatedAt);
					return undefined;
				}

				return toPlaygroundTanstackErrors(outcome);
			},
		},
		onSubmit: ({ formApi, value }) => {
			formApi.reset(value);
		},
	});

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<form.Field name="customer">
				{(field) => (
					<>
						<input
							aria-label="customer"
							value={field.state.value}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						{messagesOf(field.state.meta.errors).map((message) => (
							<span key={message} role="alert">
								{message}
							</span>
						))}
					</>
				)}
			</form.Field>
			{initial.items.map((item, index) => (
				<form.Field key={item.sku} name={`items[${index}].qty`}>
					{(field) => (
						<div>
							<input
								aria-label={`qty ${String(index)}`}
								type="number"
								value={field.state.value}
								onChange={(event) => field.handleChange(Number(event.target.value))}
							/>
							{messagesOf(field.state.meta.errors).map((message) => (
								<span key={message} role="alert">
									{message}
								</span>
							))}
						</div>
					)}
				</form.Field>
			))}
			<form.Subscribe selector={(state) => state.errors}>
				{(errors) =>
					messagesOf(errors).map((message) => (
						<p key={message} role="alert">
							{message}
						</p>
					))
				}
			</form.Subscribe>
			<button type="submit">save</button>
			{savedVersion !== null ? <p>saved v{savedVersion}</p> : null}
		</form>
	);
};
