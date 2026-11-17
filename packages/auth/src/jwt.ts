// jwt.ts - checks that an ID token really comes from OpenAI and is meant for us.
//
// An ID token is three base64url parts joined by dots: header.payload.signature.
// The payload says who signed in. The signature proves OpenAI wrote it. We check
// the signature with OpenAI's published public keys (the "JWKS"), then the claims.

import { createPublicKey, verify } from "node:crypto";

export interface IdTokenChecks {
  jwksUri: string;    // where OpenAI publishes its public keys
  issuer: string;     // who must have issued the token
  audience: string;   // who it must be for: our issued client id
  nonce: string;      // the random value we sent; proves this token answers our request
}

export interface IdTokenClaims {
  sub: string;
  email?: string;
  iss: string;
  [claim: string]: unknown;
}

export async function verifyIdToken(token: string, checks: IdTokenChecks): Promise<IdTokenClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("The ID token is malformed.");
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  const claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as IdTokenClaims;

  // 1. Signature: find the key OpenAI says it used ("kid"), and verify with it.
  const response = await fetch(checks.jwksUri, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Could not download OpenAI's keys (${response.status}).`);
  const { keys } = (await response.json()) as { keys: any[] };
  const jwk = keys.find((k) => k.kid === header.kid) ?? (keys.length === 1 ? keys[0] : undefined);
  if (!jwk) throw new Error("The ID token was signed with an unknown key.");

  const key = createPublicKey({ key: jwk, format: "jwk" });
  const data = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(signatureB64, "base64url");
  let valid: boolean;
  if (header.alg === "RS256") valid = verify("RSA-SHA256", data, key, signature);
  else if (header.alg === "ES256") valid = verify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, signature);
  else throw new Error(`Unsupported ID token algorithm: ${header.alg}`);
  if (!valid) throw new Error("The ID token's signature is not valid.");

  // 2. Claims: issued by OpenAI, for us, not expired, answering our request.
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== checks.issuer) throw new Error("The ID token comes from an unexpected issuer.");
  if (!audiences.includes(checks.audience)) throw new Error("The ID token is not meant for Tygig.");
  if (typeof claims.exp !== "number" || claims.exp + 60 < now) throw new Error("The ID token has expired.");
  if (claims.nonce !== checks.nonce) throw new Error("The ID token does not answer this sign-in.");
  if (typeof claims.sub !== "string") throw new Error("The ID token has no account id.");

  return claims;
}
