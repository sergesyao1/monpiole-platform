export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly code: string;
  readonly correlationId: string;
  readonly errors?: readonly Readonly<{ path: string; code: string }>[];
}

export class ApiProblem extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
  }
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ProblemDetails>;
  return typeof candidate.type === "string"
    && typeof candidate.title === "string"
    && typeof candidate.status === "number"
    && typeof candidate.code === "string"
    && typeof candidate.correlationId === "string";
}
