import { describe, expect, it, vi } from "vitest";
import {
  FirstAdministratorBootstrapNotCompletableError,
  FirstAdministratorBootstrapTokenExpiredError,
  FirstAdministratorBootstrapTokenNotFoundError,
  FirstAdministratorIdentityLinkConflictError,
} from "@monpiole/agency-onboarding";

import {
  FirstAdministratorBootstrapCompletionController,
} from "../../src/http/agency-onboarding/first-administrator-bootstrap-completion.controller.js";
import type {
  RequestWithContext,
} from "../../src/http/request-context/request-context.js";

const ISSUER = "https://monpiole-dev-ci.eu.auth0.com/";
const SUBJECT = "auth0|first-agency-administrator";

const RESULT = Object.freeze({
  registrationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  administratorId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  role: "TENANT_ADMINISTRATOR" as const,
  status: "ACTIVE" as const,
  identityLinkedAt: "2026-09-18T22:00:00.000Z",
  activatedAt: "2026-09-18T22:05:00.000Z",
});

const REQUEST = {
  headers: {
    authorization: "Bearer signed-token",
  },
} as RequestWithContext;

interface HttpExceptionLike {
  getStatus(): number;
}

function statusOf(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "getStatus" in error &&
    typeof (error as HttpExceptionLike).getStatus === "function"
  ) {
    return (error as HttpExceptionLike).getStatus();
  }

  return undefined;
}

describe("FirstAdministratorBootstrapCompletionController", () => {
  it("derives issuer and subject from verified authentication", async () => {
    const execute = vi.fn(async () => RESULT);

    const controller =
      new FirstAdministratorBootstrapCompletionController(
        { execute },
        {
          resolve: vi.fn(async () => ({
            issuer: ISSUER,
            subject: SUBJECT,
            authenticationMethods: [],
          })),
        },
      );

    await expect(
      controller.complete(
        { bootstrapToken: "opaque-bootstrap-token" },
        REQUEST,
      ),
    ).resolves.toEqual(RESULT);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith({
      bootstrapToken: "opaque-bootstrap-token",
      issuer: ISSUER,
      subject: SUBJECT,
    });
  });

  it("returns 401 when authentication is not verified", async () => {
    const execute = vi.fn(async () => RESULT);

    const controller =
      new FirstAdministratorBootstrapCompletionController(
        { execute },
        { resolve: vi.fn(async () => undefined) },
      );

    const error = await controller
      .complete(
        { bootstrapToken: "opaque-bootstrap-token" },
        REQUEST,
      )
      .catch((caught: unknown) => caught);

    expect(statusOf(error)).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    [
      new FirstAdministratorBootstrapTokenNotFoundError(),
      404,
    ],
    [
      new FirstAdministratorBootstrapTokenExpiredError(),
      410,
    ],
    [
      new FirstAdministratorBootstrapNotCompletableError("CANCELLED"),
      409,
    ],
    [
      new FirstAdministratorIdentityLinkConflictError(),
      409,
    ],
  ])(
    "maps completion domain errors to HTTP status %i",
    async (domainError, expectedStatus) => {
      const controller =
        new FirstAdministratorBootstrapCompletionController(
          {
            execute: vi.fn(async () => {
              throw domainError;
            }),
          },
          {
            resolve: vi.fn(async () => ({
              issuer: ISSUER,
              subject: SUBJECT,
              authenticationMethods: [],
            })),
          },
        );

      const error = await controller
        .complete(
          { bootstrapToken: "opaque-bootstrap-token" },
          REQUEST,
        )
        .catch((caught: unknown) => caught);

      expect(statusOf(error)).toBe(expectedStatus);
    },
  );
});