import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { OidcAccessTokenVerifier } from "../../apps/api/src/authentication/oidc-access-token-verifier.js";

const ISSUER = "https://login.example.test/";
const AUDIENCE = "https://api.monpiole.example";
const configuration = {
  issuer: ISSUER, audience: AUDIENCE, jwksUri: "https://login.example.test/.well-known/jwks.json",
  algorithms: ["RS256"] as const, clockToleranceSeconds: 0, maximumTokenAgeSeconds: 900,
};

describe("OIDC access-token security policy", () => {
  let privateKey: CryptoKey;
  let verifier: OidcAccessTokenVerifier;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    const publicJwk = await exportJWK(pair.publicKey);
    verifier = new OidcAccessTokenVerifier(configuration, createLocalJWKSet({ keys: [{ ...publicJwk, kid: "test", alg: "RS256" }] }));
  });

  it("returns only a verified provider-independent context", async () => {
    const token = await signedToken({ amr: ["pwd", "mfa"], auth_time: Math.floor(Date.now() / 1000) - 5 });
    await expect(verifier.verify(token)).resolves.toMatchObject({
      issuer: ISSUER, subject: "auth0|subject-1", authenticationMethods: ["pwd", "mfa"],
    });
  });

  it.each([
    ["wrong issuer", { issuer: "https://attacker.example/" }],
    ["wrong audience", { audience: "another-api" }],
    ["expired token", { expirationTime: Math.floor(Date.now() / 1000) - 1 }],
  ])("rejects %s", async (_name, override) => {
    await expect(verifier.verify(await signedToken(override))).rejects.toBeDefined();
  });

  it("rejects an invalid signature", async () => {
    const other = await generateKeyPair("RS256");
    await expect(verifier.verify(await signedToken({}, other.privateKey))).rejects.toBeDefined();
  });

  async function signedToken(
    override: { issuer?: string; audience?: string; expirationTime?: number; amr?: string[]; auth_time?: number },
    signingKey = privateKey,
  ) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ amr: override.amr, auth_time: override.auth_time })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(override.issuer ?? ISSUER).setAudience(override.audience ?? AUDIENCE)
      .setSubject("auth0|subject-1").setIssuedAt(now).setExpirationTime(override.expirationTime ?? now + 300)
      .sign(signingKey);
  }
});
