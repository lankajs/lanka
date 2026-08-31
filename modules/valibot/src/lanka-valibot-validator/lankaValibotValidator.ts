import { lankaStandardValidator } from "lanka/validation";
import type { ILankaValidator } from "lanka/validation";

/**
 * The validator for valibot schemas.
 *
 * This is `lankaStandardValidator` under a name that says which library it is
 * for: valibot implements Standard Schema and there is nothing to translate. The
 * name exists so an application's code shows what it validates with.
 */
export const lankaValibotValidator: ILankaValidator = lankaStandardValidator;
