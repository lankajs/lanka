import { useState } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { applyPlaygroundHookFormErrors } from "../apply-playground-hook-form-errors/applyPlaygroundHookFormErrors";
import { playgroundOrderInputSchema } from "../playground-order-input-schema/playgroundOrderInputSchema";
import type { IPlaygroundFormScreenProps } from "../_interfaces/IPlaygroundFormScreenProps";
import type { IPlaygroundOrderInput } from "../_interfaces/IPlaygroundOrderInput";

/**
 * The edit form on React Hook Form.
 *
 * The resolver is the application's own Standard Schema — the same object the
 * gateway checks the payload with — so nothing is written twice. The form owns
 * the values and the per-input errors; the ViewModel is called once, on submit,
 * and answers with addressed failures, which `applyPlaygroundHookFormErrors`
 * places.
 */
export const PlaygroundHookFormScreen = ({ initial, submit }: IPlaygroundFormScreenProps) => {
	const [savedVersion, setSavedVersion] = useState<number | null>(null);
	const form = useForm<IPlaygroundOrderInput>({
		defaultValues: initial,
		resolver: standardSchemaResolver(playgroundOrderInputSchema),
	});
	const { errors } = form.formState;

	const onSubmit = form.handleSubmit(async (values) => {
		const outcome = await submit(values);
		if (outcome.ok) {
			form.reset(values);
			setSavedVersion(outcome.data.updatedAt);
			return;
		}

		applyPlaygroundHookFormErrors(form, outcome);
	});

	return (
		<form
			onSubmit={(event) => {
				void onSubmit(event);
			}}
		>
			<input aria-label="customer" {...form.register("customer")} />
			{errors.customer ? <span role="alert">{errors.customer.message}</span> : null}
			{initial.items.map((item, index) => (
				<div key={item.sku}>
					<input
						aria-label={`qty ${String(index)}`}
						type="number"
						{...form.register(`items.${index}.qty`, { valueAsNumber: true })}
					/>
					{errors.items?.[index]?.qty ? (
						<span role="alert">{errors.items[index]?.qty?.message}</span>
					) : null}
				</div>
			))}
			{errors.root ? <p role="alert">{errors.root.message}</p> : null}
			<button type="submit">save</button>
			{savedVersion !== null ? <p>saved v{savedVersion}</p> : null}
		</form>
	);
};
