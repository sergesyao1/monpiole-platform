import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

interface Auth0Event {
  readonly resource_server?: { readonly identifier?: unknown };
  readonly secrets?: { readonly MONPIOLE_API_AUDIENCE?: unknown };
  readonly user: { readonly email?: unknown; readonly email_verified?: unknown };
}

type ActionHandler = (
  event: Auth0Event,
  api: { readonly accessToken: { readonly setCustomClaim: (name: string, value: unknown) => void } },
) => Promise<void>;

const MONPIOLE_AUDIENCE = "https://api.monpiole.local";

describe("Auth0 verified e-mail Post Login Action", () => {
  it("emits the exact MonPiole claims for the configured API only", async () => {
    const handler = await loadAction();
    const setCustomClaim = vi.fn();

    await handler(eventFor(MONPIOLE_AUDIENCE), { accessToken: { setCustomClaim } });

    expect(setCustomClaim.mock.calls).toEqual([
      [`${MONPIOLE_AUDIENCE}/claims/email`, "admin@example.test"],
      [`${MONPIOLE_AUDIENCE}/claims/email_verified`, true],
    ]);
  });

  it.each([
    ["an unrelated API", "https://api.other.example", MONPIOLE_AUDIENCE],
    ["a missing resource server", undefined, MONPIOLE_AUDIENCE],
    ["a missing configured audience", MONPIOLE_AUDIENCE, null],
  ])("emits no claims for %s", async (_case, resourceAudience, configuredAudience) => {
    const handler = await loadAction();
    const setCustomClaim = vi.fn();

    await handler(eventFor(resourceAudience, configuredAudience), {
      accessToken: { setCustomClaim },
    });

    expect(setCustomClaim).not.toHaveBeenCalled();
  });

  it("does not emit a blank e-mail and treats truthy verification as false", async () => {
    const handler = await loadAction();
    const setCustomClaim = vi.fn();

    await handler(
      {
        ...eventFor(MONPIOLE_AUDIENCE),
        user: { email: "   ", email_verified: "true" },
      },
      { accessToken: { setCustomClaim } },
    );

    expect(setCustomClaim.mock.calls).toEqual([
      [`${MONPIOLE_AUDIENCE}/claims/email_verified`, false],
    ]);
  });

  it("normalizes a trailing audience slash without creating a double slash", async () => {
    const handler = await loadAction();
    const setCustomClaim = vi.fn();
    const audience = `${MONPIOLE_AUDIENCE}/`;

    await handler(eventFor(audience, audience), { accessToken: { setCustomClaim } });

    expect(setCustomClaim.mock.calls[0]?.[0]).toBe(
      `${MONPIOLE_AUDIENCE}/claims/email`,
    );
  });
});

function eventFor(
  resourceAudience: string | undefined,
  configuredAudience: string | null = MONPIOLE_AUDIENCE,
): Auth0Event {
  return {
    ...(resourceAudience === undefined
      ? {}
      : { resource_server: { identifier: resourceAudience } }),
    ...(configuredAudience === null
      ? {}
      : { secrets: { MONPIOLE_API_AUDIENCE: configuredAudience } }),
    user: { email: " admin@example.test ", email_verified: true },
  };
}

async function loadAction(): Promise<ActionHandler> {
  const source = await readFile(
    new URL(
      "../../../../engineering/auth0/actions/add-monpiole-verified-email-claims.js",
      import.meta.url,
    ),
    "utf8",
  );
  const sandbox: { exports: { onExecutePostLogin?: ActionHandler } } = {
    exports: {},
  };
  runInNewContext(source, sandbox, {
    filename: "add-monpiole-verified-email-claims.js",
  });
  const handler = sandbox.exports.onExecutePostLogin;
  if (handler === undefined) {
    throw new Error("Auth0 Action does not export onExecutePostLogin");
  }
  return handler;
}
