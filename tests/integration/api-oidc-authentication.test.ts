import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OidcAccessTokenVerifier } from "../../apps/api/src/authentication/oidc-access-token-verifier.js";
import { OidcAuthenticatedAuthorityProvider } from "../../apps/api/src/authentication/oidc-authenticated-authority-provider.js";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";

const ISSUER = "https://login.example.test/";
const AUDIENCE = "https://api.monpiole.example";

describe("OIDC authentication HTTP boundary", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>>;
  let baseUrl: string;
  let privateKey: CryptoKey;
  let executed = 0;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    const jwk = await exportJWK(pair.publicKey);
    const tokens = new OidcAccessTokenVerifier({
      issuer: ISSUER, audience: AUDIENCE, jwksUri: `${ISSUER}.well-known/jwks.json`,
      algorithms: ["RS256"], clockToleranceSeconds: 0, maximumTokenAgeSeconds: 900,
    }, createLocalJWKSet({ keys: [{ ...jwk, kid: "integration", alg: "RS256" }] }));
    const authenticatedAuthorityProvider = new OidcAuthenticatedAuthorityProvider(tokens, {
      resolve: async ({ issuer, subject }) => issuer === ISSUER && subject === "auth0|platform-admin"
        ? { actorId: "internal-actor", authorityId: "platform-admin", grants: ["CREATE_TENANT"], tenantIds: [] }
        : undefined,
    });
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider,
      createTenant: { execute: async () => {
        executed += 1;
        return {
          tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          lifecycleState: "PENDING", createdAt: "2026-08-25T12:00:00.000Z",
        };
      } },
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => application.close());

  it("verifies a token, resolves internal authority, and reaches the protected endpoint", async () => {
    const response = await request(await token());
    expect(response.status).toBe(201);
    expect(executed).toBe(1);
  });

  it("returns safe 401 and performs no use-case call for a wrong audience", async () => {
    const response = await request(await token({ audience: "another-api" }));
    expect(response.status).toBe(401);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("UNAUTHORIZED");
    expect(executed).toBe(1);
  });

  it.each([
    ["unknown external identity", { subject: "auth0|unknown" }],
    ["wrong issuer", { issuer: "https://other.example.test/" }],
    ["expired token", { expirationTime: Math.floor(Date.now() / 1000) - 1 }],
  ])("returns 401 for %s without invoking the protected operation", async (_name, override) => {
    const before = executed;
    const response = await request(await token(override));
    expect(response.status).toBe(401);
    expect(ProblemDetailsSchema.parse(await response.json()).code).toBe("UNAUTHORIZED");
    expect(executed).toBe(before);
  });

  it("returns 401 for an invalid bearer token", async () => {
    const before = executed;
    const response = await request("not-a-jwt");
    expect(response.status).toBe(401);
    expect(executed).toBe(before);
  });

  async function token(override: { audience?: string; issuer?: string; subject?: string; expirationTime?: number } = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({}).setProtectedHeader({ alg: "RS256", kid: "integration" })
      .setIssuer(override.issuer ?? ISSUER).setAudience(override.audience ?? AUDIENCE)
      .setSubject(override.subject ?? "auth0|platform-admin")
      .setIssuedAt(now).setExpirationTime(override.expirationTime ?? now + 300).sign(privateKey);
  }

  function request(accessToken: string) {
    return fetch(`${baseUrl}/api/v1/tenants`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`, "content-type": "application/json", "idempotency-key": "oidc-test",
      },
      body: JSON.stringify({
        organizationName: "Agency", responsiblePersonName: "Admin", responsibleEmail: "admin@example.test",
        responsibleTelephone: "+2250102030405", country: "CI",
      }),
    });
  }
});
