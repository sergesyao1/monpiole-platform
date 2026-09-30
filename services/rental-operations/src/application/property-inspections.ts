import type { RentalOperationsAuthority } from "./operational-lifecycle.js";
import { RentalOperationsForbiddenError } from "./operational-lifecycle.js";
import type { PropertyInspectionType, RentalOperationMode } from "../domain/rental-operations.js";

export const CONDITION_ASSESSMENTS = ["GOOD", "FAIR", "POOR", "DAMAGED", "MISSING"] as const;
export type ConditionAssessment = typeof CONDITION_ASSESSMENTS[number];
export const EVIDENCE_TYPES = ["PHOTO", "SIGNATURE", "DOCUMENT"] as const;
export type InspectionEvidenceType = typeof EVIDENCE_TYPES[number];

export interface InspectionConditionRecord {
  readonly area: string;
  readonly item: string;
  readonly assessment: ConditionAssessment;
  readonly observation?: string;
  readonly damageObserved: boolean;
}

export interface InspectionEvidenceReference {
  readonly type: InspectionEvidenceType;
  readonly referenceId: string;
}

export type InspectionSource =
  | Readonly<{ type: "LEASE"; id: string }>
  | Readonly<{ type: "BOOKING"; id: string }>
  | Readonly<{ type: "OCCUPANCY"; id: string }>;

export interface CompletedPropertyInspection {
  readonly inspectionId: string;
  readonly tenantId: string;
  readonly rentableAssetId: string;
  readonly mode: RentalOperationMode;
  readonly type: PropertyInspectionType;
  readonly source: InspectionSource;
  readonly occurredAt: string;
  readonly responsibleActorId: string;
  readonly status: "COMPLETED";
  readonly conditionRecords: readonly InspectionConditionRecord[];
  readonly evidenceReferences: readonly InspectionEvidenceReference[];
}

export interface PropertyInspectionRepository {
  complete(input: Readonly<{
    tenantId: string;
    actorId: string;
    inspectionId: string;
    idempotencyKey: string;
    mode: RentalOperationMode;
    type: PropertyInspectionType;
    source: InspectionSource;
    occurredAt: string;
    conditionRecords: readonly InspectionConditionRecord[];
    evidenceReferences: readonly InspectionEvidenceReference[];
  }>): Promise<CompletedPropertyInspection>;
  findEntryForExit(tenantId: string, occupancyId: string): Promise<CompletedPropertyInspection | undefined>;
}

export class InvalidInspectionInputError extends Error { readonly code = "INVALID_INSPECTION_INPUT"; }

export class CompletePropertyInspection {
  constructor(private readonly repository: PropertyInspectionRepository) {}

  execute(command: Readonly<{
    authority: RentalOperationsAuthority;
    inspectionId: string;
    idempotencyKey: string;
    mode: RentalOperationMode;
    type: PropertyInspectionType;
    source: InspectionSource;
    occurredAt: string;
    conditionRecords: readonly InspectionConditionRecord[];
    evidenceReferences: readonly InspectionEvidenceReference[];
  }>): Promise<CompletedPropertyInspection> {
    if (!command.authority.grants.includes("MANAGE_RENTAL_OPERATIONS") || command.authority.tenantIds.length !== 1) {
      throw new RentalOperationsForbiddenError();
    }
    validateInspection(command);
    return this.repository.complete({ ...command, tenantId: command.authority.tenantIds[0]!, actorId: command.authority.actorId });
  }
}

export interface InspectionDifference {
  readonly area: string;
  readonly item: string;
  readonly entryAssessment?: ConditionAssessment;
  readonly exitAssessment: ConditionAssessment;
  readonly kind: "CHANGED_CONDITION" | "NEW_DAMAGE" | "MISSING_ITEM" | "NEW_ITEM";
}

export function compareInspectionConditions(
  entry: readonly InspectionConditionRecord[],
  exit: readonly InspectionConditionRecord[],
): readonly InspectionDifference[] {
  const baseline = new Map(entry.map((record) => [`${record.area}\u0000${record.item}`, record]));
  const differences: InspectionDifference[] = [];
  for (const record of exit) {
    const previous = baseline.get(`${record.area}\u0000${record.item}`);
    if (previous === undefined) {
      differences.push({ area: record.area, item: record.item, exitAssessment: record.assessment, kind: "NEW_ITEM" });
      continue;
    }
    if (record.assessment === "MISSING" && previous.assessment !== "MISSING") {
      differences.push({ area: record.area, item: record.item, entryAssessment: previous.assessment, exitAssessment: record.assessment, kind: "MISSING_ITEM" });
      continue;
    }
    if (record.damageObserved && !previous.damageObserved) {
      differences.push({ area: record.area, item: record.item, entryAssessment: previous.assessment, exitAssessment: record.assessment, kind: "NEW_DAMAGE" });
      continue;
    }
    if (record.assessment !== previous.assessment) {
      differences.push({ area: record.area, item: record.item, entryAssessment: previous.assessment, exitAssessment: record.assessment, kind: "CHANGED_CONDITION" });
    }
  }
  return differences;
}

function validateInspection(input: Readonly<{ type: PropertyInspectionType; mode: RentalOperationMode; source: InspectionSource; occurredAt: string; conditionRecords: readonly InspectionConditionRecord[]; evidenceReferences: readonly InspectionEvidenceReference[] }>): void {
  const entrySourceValid = input.type === "ENTRY" && ((input.mode === "LONG_TERM_RENTAL" && input.source.type === "LEASE")
    || (input.mode === "SHORT_TERM_RENTAL" && input.source.type === "BOOKING"));
  if (!entrySourceValid && !(input.type === "EXIT" && input.source.type === "OCCUPANCY")) throw new InvalidInspectionInputError();
  if (!input.occurredAt.endsWith("Z") || !Number.isFinite(Date.parse(input.occurredAt))) throw new InvalidInspectionInputError();
  for (const record of input.conditionRecords) {
    if (record.area.trim() === "" || record.item.trim() === "" || !CONDITION_ASSESSMENTS.includes(record.assessment)) throw new InvalidInspectionInputError();
  }
  for (const evidence of input.evidenceReferences) {
    if (!EVIDENCE_TYPES.includes(evidence.type) || evidence.referenceId.trim() === "") throw new InvalidInspectionInputError();
  }
}
