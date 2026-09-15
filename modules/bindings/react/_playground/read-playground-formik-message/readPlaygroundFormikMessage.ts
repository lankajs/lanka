import { getIn } from "formik";
import type { FormikErrors } from "formik";
import type { IPlaygroundOrderInput } from "../_interfaces/IPlaygroundOrderInput";

/**
 * One message, wherever Formik put it in its nested error object.
 *
 * Its own file rather than a second export beside the options factory: the
 * factory BUILDS a form and this READS one, which is two subjects however
 * closely they travel. The address is spelled the way Formik spells it —
 * `items.1.qty` — because `getIn` is what walks it.
 */
export const readPlaygroundFormikMessage = (
	errors: FormikErrors<IPlaygroundOrderInput>,
	address: string,
): string | undefined => getIn(errors, address) as string | undefined;
