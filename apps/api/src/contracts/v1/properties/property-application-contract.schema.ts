import { z } from "zod";
import { PropertyContractResponseSchema } from "./property-client-contract.schema.js";
import { PropertyApplicationPathSchema } from "./property-application.schema.js";

export const CreatePropertyApplicationContractRequestSchema=z.object({
  reference:z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9._/ -]{0,99}$/u),
  startDate:z.iso.date().optional(),endDate:z.iso.date().optional(),notes:z.string().trim().min(1).max(5000).optional(),
}).strict().refine(value=>value.startDate===undefined||value.endDate===undefined||value.endDate>=value.startDate,{path:["endDate"],message:"End date must not precede start date"});
export { PropertyApplicationPathSchema, PropertyContractResponseSchema };
