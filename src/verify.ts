// The envelope check and the Ed25519 signature check (CONTRACT.md section 3).
// Uses only WebCrypto, so it runs in Node.js 20.9+, Bun, Deno and workerd.

import { decodeBase64Url } from "./base64url.js";
import {
  ENVELOPE_KEYS,
  KEY_ID_PATTERN,
  LIMITS,
  PUBLIC_KEY_PATTERN,
  SIGNATURE_PATTERN,
} from "./contract.js";
import { PUBLIC_KEYS } from "./keys.js";

/** Why an envelope was refused. Every one of them is wall level. */
export type VerifyReason = "envelope" | "too_large" | "key" | "signature" | "crypto";

export type VerifyResult =
  | {
      readonly ok: true;
      readonly payload: string;
      readonly keyId: string;
      readonly signature: string;
    }
  | { readonly ok: false; readonly reason: VerifyReason; readonly detail: string };

const MAX_CACHED_KEYS = 32;
const keyCache = new Map<string, Promise<CryptoKey>>();

/** The raw 32 bytes of a public key, or null when it is not one (a placeholder, say). */
export function decodePublicKey(value: unknown): Uint8Array<ArrayBuffer> | null {
  if (typeof value !== "string" || !PUBLIC_KEY_PATTERN.test(value)) return null;
  const raw = decodeBase64Url(value);
  return raw !== null && raw.length === 32 ? raw : null;
}

function importKey(publicKey: string, raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const cached = keyCache.get(publicKey);
  if (cached) return cached;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return Promise.reject(new Error("WebCrypto is missing"));
  const pending = subtle.importKey("raw", raw, { name: "Ed25519" }, false, ["verify"]);
  if (keyCache.size >= MAX_CACHED_KEYS) keyCache.clear();
  keyCache.set(publicKey, pending);
  pending.catch(() => keyCache.delete(publicKey));
  return pending;
}

function refuse(reason: VerifyReason, detail: string): VerifyResult {
  return { ok: false, reason, detail };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks an envelope (the parsed response body) and its signature against
 * `publicKeys` (default: the pinned production keys). Never throws.
 */
export async function verifyEnvelopeDetailed(
  body: unknown,
  publicKeys: Readonly<Record<string, string>> = PUBLIC_KEYS,
): Promise<VerifyResult> {
  if (!isObject(body)) return refuse("envelope", "the answer is not a JSON object");
  const keys = Object.keys(body);
  if (keys.length !== ENVELOPE_KEYS.length || !ENVELOPE_KEYS.every((key) => keys.includes(key))) {
    return refuse("envelope", "the answer does not have exactly payload, signature and keyId");
  }
  const { payload, signature, keyId } = body;
  if (typeof payload !== "string" || typeof signature !== "string" || typeof keyId !== "string") {
    return refuse("envelope", "payload, signature and keyId must be strings");
  }
  if (!KEY_ID_PATTERN.test(keyId)) return refuse("envelope", "keyId is malformed");
  const signatureBytes = SIGNATURE_PATTERN.test(signature) ? decodeBase64Url(signature) : null;
  if (signatureBytes === null || signatureBytes.length !== 64) {
    return refuse("envelope", "signature is not 64 bytes of base64url");
  }
  // UTF-8 never takes fewer bytes than UTF-16 code units, so this needs no encoding.
  if (payload.length > LIMITS.payloadBytes) return refuse("too_large", "payload over 512 KiB");
  const payloadBytes = new TextEncoder().encode(payload);
  if (payloadBytes.length > LIMITS.payloadBytes) {
    return refuse("too_large", "payload over 512 KiB");
  }

  if (!Object.hasOwn(publicKeys, keyId)) {
    return refuse("key", `the wall is signed with a key this package does not know (${keyId})`);
  }
  const publicKey = publicKeys[keyId];
  const raw = decodePublicKey(publicKey);
  if (raw === null || publicKey === undefined) {
    return refuse("key", `the public key for ${keyId} is not a 32-byte base64url key`);
  }

  let valid: boolean;
  try {
    const key = await importKey(publicKey, raw);
    valid = await globalThis.crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      signatureBytes,
      payloadBytes,
    );
  } catch {
    return refuse("crypto", "this runtime cannot check Ed25519 signatures");
  }
  if (!valid) return refuse("signature", "the signature does not match the payload");
  return { ok: true, payload, keyId, signature };
}

/**
 * Checks an envelope and its signature. Returns the payload text, or null.
 * Never throws.
 */
export async function verifyEnvelope(
  body: unknown,
  publicKeys?: Readonly<Record<string, string>>,
): Promise<string | null> {
  const result = await verifyEnvelopeDetailed(body, publicKeys);
  return result.ok ? result.payload : null;
}
