import { useFormik } from "formik";
import {
	createPlaygroundFormikOptions,
	playgroundFormikMessageAt,
} from "../create-playground-formik-options/createPlaygroundFormikOptions";
import type { IPlaygroundFormikStatus } from "../create-playground-formik-options/createPlaygroundFormikOptions";
import type { IPlaygroundFormScreenProps } from "../_interfaces/IPlaygroundFormScreenProps";

/**
 * The edit form on Formik — a library that does not read Standard Schema.
 *
 * The screen is only the inputs. Everything that meets the ViewModel is in
 * `createPlaygroundFormikOptions`, which is the same ten lines every other form
 * library needs and differs from them in one thing: how it spells an address.
 */
export const PlaygroundFormikScreen = (props: IPlaygroundFormScreenProps) => {
	const formik = useFormik(createPlaygroundFormikOptions(props));
	const status = (formik.status ?? {}) as IPlaygroundFormikStatus;
	const messageAt = (address: string) => playgroundFormikMessageAt(formik.errors, address);

	return (
		<form onSubmit={formik.handleSubmit}>
			<input
				aria-label="customer"
				name="customer"
				value={formik.values.customer}
				onChange={formik.handleChange}
			/>
			{messageAt("customer") ? <span role="alert">{messageAt("customer")}</span> : null}
			{formik.values.items.map((item, index) => (
				<div key={item.sku}>
					<input
						aria-label={`qty ${String(index)}`}
						type="number"
						name={`items.${String(index)}.qty`}
						value={item.qty}
						onChange={(event) => {
							void formik.setFieldValue(
								`items.${String(index)}.qty`,
								Number(event.target.value),
							);
						}}
					/>
					{messageAt(`items.${String(index)}.qty`) ? (
						<span role="alert">{messageAt(`items.${String(index)}.qty`)}</span>
					) : null}
				</div>
			))}
			{status.root ? <p role="alert">{status.root}</p> : null}
			<button type="submit">save</button>
			{status.savedVersion !== undefined ? <p>saved v{status.savedVersion}</p> : null}
		</form>
	);
};
