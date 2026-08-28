import { ApiForbiddenError, ApiSessionExpiredError } from "../../infrastructure/http/api-client.js";
import { ApiProblem } from "../../infrastructure/http/problem-details.js";

export type PropertyErrorKind = "session" | "forbidden" | "not-found" | "validation" | "conflict" | "unexpected";
export interface PropertyUiError { readonly kind: PropertyErrorKind; readonly message: string; }

export function toPropertyUiError(error: unknown): PropertyUiError {
  if (error instanceof ApiSessionExpiredError) {
    return { kind: "session", message: "Votre session n’est plus utilisable. Veuillez vous reconnecter." };
  }
  if (error instanceof ApiForbiddenError) {
    return { kind: "forbidden", message: "Vous ne disposez pas de l’autorisation nécessaire pour cette action." };
  }
  if (error instanceof ApiProblem && error.problem.status === 404) {
    return { kind: "not-found", message: "Ce bien est introuvable ou n’est pas accessible dans votre espace." };
  }
  if (error instanceof ApiProblem && error.problem.status === 400) {
    return { kind: "validation", message: "Certaines informations sont invalides. Vérifiez le formulaire puis réessayez." };
  }
  if (error instanceof ApiProblem && error.problem.status === 409) {
    return { kind: "conflict", message: "Cette affectation existe déjà ou la quote-part totale dépasserait 100 %." };
  }
  return { kind: "unexpected", message: "Une erreur inattendue est survenue. Réessayez dans quelques instants." };
}
