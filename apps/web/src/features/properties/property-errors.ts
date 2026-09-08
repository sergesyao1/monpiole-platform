import { ApiForbiddenError, ApiSessionExpiredError } from "../../infrastructure/http/api-client.js";
import { ApiProblem } from "../../infrastructure/http/problem-details.js";

export type PropertyErrorKind = "session" | "forbidden" | "not-found" | "validation" | "conflict" | "unexpected";
export interface PropertyUiError { readonly kind: PropertyErrorKind; readonly message: string; }
export type PropertyErrorResource = "property" | "composition" | "building" | "unit";

export function toPropertyUiError(error: unknown, resource: PropertyErrorResource = "property"): PropertyUiError {
  if (error instanceof ApiSessionExpiredError) {
    return { kind: "session", message: "Votre session n’est plus utilisable. Veuillez vous reconnecter." };
  }
  if (error instanceof ApiForbiddenError) {
    return { kind: "forbidden", message: "Vous ne disposez pas de l’autorisation nécessaire pour cette action." };
  }
  if (error instanceof ApiProblem && error.problem.status === 404) {
    if (error.problem.code === "PROPERTY_CLIENT_NOT_FOUND") {
      return { kind: "not-found", message: "Ce client est introuvable ou n’est plus accessible dans votre espace." };
    }
    if (error.problem.code === "PROPERTY_CONTRACT_NOT_FOUND") {
      return { kind: "not-found", message: "Ce contrat est introuvable ou n’est plus accessible dans votre espace." };
    }
    if (error.problem.code === "PROPERTY_BUILDING_NOT_FOUND" || resource === "building") {
      return { kind: "not-found", message: "Cet immeuble est introuvable ou n’est plus accessible dans votre espace." };
    }
    if (error.problem.code === "PROPERTY_UNIT_NOT_FOUND" || resource === "unit") {
      return { kind: "not-found", message: "Cette unité est introuvable ou n’est plus accessible dans cet immeuble." };
    }
    if (resource === "composition") {
      return { kind: "not-found", message: "La composition de ce bien est introuvable ou n’est plus accessible." };
    }
    return { kind: "not-found", message: "Ce bien est introuvable ou n’est pas accessible dans votre espace." };
  }
  if (error instanceof ApiProblem && error.problem.status === 400) {
    return { kind: "validation", message: "Certaines informations sont invalides. Vérifiez le formulaire puis réessayez." };
  }
  if (error instanceof ApiProblem && error.problem.status === 409) {
    if (error.problem.code === "PROPERTY_CONTRACT_REFERENCE_CONFLICT") {
      return { kind: "conflict", message: "Cette référence de contrat est déjà utilisée." };
    }
    if (error.problem.code === "PROPERTY_CONTRACT_TRANSITION_NOT_ALLOWED") {
      return { kind: "conflict", message: "Cette transition n’est pas autorisée pour l’état actuel du contrat." };
    }
    if (error.problem.code === "PROPERTY_CONTRACT_UPDATE_NOT_ALLOWED") {
      return { kind: "conflict", message: "Seul un contrat brouillon peut être modifié." };
    }
    if (error.problem.code === "PROPERTY_CONTRACT_PROPERTY_NOT_ELIGIBLE") {
      return { kind: "conflict", message: "Ce type de contrat n’est pas compatible avec ce bien." };
    }
    if (error.problem.code === "PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET") {
      if (error.problem.errors?.some((item) => item.path === "property.primaryPhoto")) {
        return { kind: "conflict", message: "Sélectionnez la photo principale qui représentera ce bien dans les annonces." };
      }
      return { kind: "conflict", message: "Complétez les détails et les conditions commerciales avant de publier." };
    }
    if (error.problem.code === "PROPERTY_NOT_PUBLISHED") {
      return { kind: "conflict", message: "Seul un bien actuellement publié peut être retiré du catalogue." };
    }
    if (error.problem.code === "PROPERTY_REPUBLICATION_NOT_SUPPORTED") {
      return { kind: "conflict", message: "La republication d’un bien retiré du catalogue n’est pas encore disponible." };
    }
    if (error.problem.code === "PROPERTY_PRIMARY_PHOTO_DELETION_FORBIDDEN") {
      return { kind: "conflict", message: "Sélectionnez une photo remplaçante avant de supprimer la photo principale." };
    }
    if (error.problem.code === "PROPERTY_PUBLISHED_PHOTO_MUTATION_FORBIDDEN") {
      return { kind: "conflict", message: "Cette suppression rendrait la galerie du bien publié non conforme. Ajoutez d’abord une image remplaçante." };
    }
    if (error.problem.code === "PROPERTY_BUILDING_CODE_CONFLICT") return { kind: "conflict", message: "Ce code d’immeuble est déjà utilisé pour ce bien." };
    if (error.problem.code === "PROPERTY_UNIT_CODE_CONFLICT") return { kind: "conflict", message: "Ce code d’unité est déjà utilisé dans cet immeuble." };
    if (error.problem.code === "PROPERTY_COMPOSITION_ROLE_CONFLICT") return { kind: "conflict", message: "Une unité ne peut pas contenir d’immeuble." };
    if (error.problem.code === "PROPERTY_UNIT_GEOLOCATION_INHERITED") return { kind: "conflict", message: "La géolocalisation d’une unité est gérée depuis son ensemble immobilier parent." };
    if (error.problem.code === "PROPERTY_AVAILABILITY_DERIVED_FROM_UNITS") return { kind: "conflict", message: "La disponibilité de cet ensemble immobilier est calculée à partir de ses unités." };
    return { kind: "conflict", message: "Cette affectation existe déjà ou la quote-part totale dépasserait 100 %." };
  }
  return { kind: "unexpected", message: "Une erreur inattendue est survenue. Réessayez dans quelques instants." };
}
