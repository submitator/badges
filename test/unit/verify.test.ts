import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { decodeBase64Url } from "../../src/base64url.js";
import { PUBLIC_KEYS } from "../../src/keys.js";
import { decodePublicKey, verifyEnvelope, verifyEnvelopeDetailed } from "../../src/verify.js";
import { envelopeFixtures, testKeys, vector } from "../support/fixtures.js";

const keys = testKeys();

/** A fresh Ed25519 key pair: signs like the server, verified through publicKeys. */
function freshSigner(keyId = "local-1") {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "jwk" }).x as string;
  return {
    publicKeys: { [keyId]: raw },
    envelope(payload: string) {
      const signature = sign(null, Buffer.from(payload, "utf8"), privateKey).toString("base64url");
      return { payload, signature, keyId };
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the shared test vector", () => {
  test("accepts the vector envelope and returns its payload", async () => {
    const v = vector();
    const result = await verifyEnvelopeDetailed(JSON.parse(v.envelope), keys);
    expect(result).toEqual({
      ok: true,
      payload: v.payload,
      keyId: v.keyId,
      signature: v.signature,
    });
    expect(new TextEncoder().encode(v.payload).length).toBe(v.payloadBytes);
  });

  test("verifyEnvelope gives the payload text", async () => {
    const v = vector();
    expect(await verifyEnvelope(JSON.parse(v.envelope), keys)).toBe(v.payload);
  });

  test("verifies the RFC 8032 TEST 1 empty-message signature", async () => {
    const v = vector();
    const raw = decodePublicKey(v.publicKey);
    const signature = decodeBase64Url(v.emptyMessageSignature);
    expect(raw).not.toBeNull();
    expect(signature?.length).toBe(64);
    const key = await crypto.subtle.importKey("raw", raw!, { name: "Ed25519" }, false, ["verify"]);
    expect(await crypto.subtle.verify({ name: "Ed25519" }, key, signature!, new Uint8Array())).toBe(
      true,
    );
  });

  test("rejects the payload changed by one character", async () => {
    const v = vector();
    const body = { ...JSON.parse(v.envelope), payload: v.payload.replace("café", "cafe") };
    const result = await verifyEnvelopeDetailed(body, keys);
    expect(result).toMatchObject({ ok: false, reason: "signature" });
  });

  test("the pinned production keys never accept the test key", async () => {
    const v = vector();
    expect(Object.keys(PUBLIC_KEYS)).not.toContain(v.keyId);
    expect(Object.values(PUBLIC_KEYS)).not.toContain(v.publicKey);
    const result = await verifyEnvelopeDetailed(JSON.parse(v.envelope));
    expect(result).toMatchObject({ ok: false, reason: "key" });
  });
});

describe("envelope fixtures", () => {
  test.each(envelopeFixtures().map((fixture) => [fixture.name, fixture] as const))(
    "%s",
    async (_name, fixture) => {
      const result = await verifyEnvelopeDetailed(JSON.parse(fixture.body), fixture.publicKeys);
      if (fixture.expect.ok) {
        expect(result.ok).toBe(true);
        expect(result.ok && result.payload).toBe(JSON.parse(fixture.body).payload);
      } else {
        expect(result).toMatchObject({ ok: false, reason: fixture.expect.reason });
      }
    },
  );
});

describe("envelope checks", () => {
  test("rejects an unknown keyId", async () => {
    const signer = freshSigner();
    const body = { ...signer.envelope("{}"), keyId: "local-2" };
    expect(await verifyEnvelopeDetailed(body, signer.publicKeys)).toMatchObject({
      ok: false,
      reason: "key",
    });
  });

  test("a pinned placeholder verifies nothing", async () => {
    const signer = freshSigner("k202611-a");
    const result = await verifyEnvelopeDetailed(signer.envelope("{}"), {
      "k202611-a": "PLACEHOLDER",
    });
    expect(result).toMatchObject({ ok: false, reason: "key" });
  });

  test.each([
    ["31 bytes", "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHUQ"],
    ["33 bytes", "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURoA"],
    ["padding", "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo="],
    ["standard base64", "11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo"],
    ["non-canonical last character", "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURp"],
  ])("rejects a public key with %s", async (_label, publicKey) => {
    const v = vector();
    const result = await verifyEnvelopeDetailed(JSON.parse(v.envelope), { [v.keyId]: publicKey });
    expect(result).toMatchObject({ ok: false, reason: "key" });
  });

  test.each([
    ["85 characters", (s: string) => s.slice(0, 85)],
    ["87 characters", (s: string) => `${s}A`],
    ["a character outside base64url", (s: string) => `${s.slice(0, 85)}+`],
  ])("rejects a signature of %s", async (_label, change) => {
    const v = vector();
    const envelope = JSON.parse(v.envelope) as { signature: string };
    const body = { ...envelope, signature: change(envelope.signature) };
    expect(await verifyEnvelopeDetailed(body, keys)).toMatchObject({
      ok: false,
      reason: "envelope",
    });
  });

  test.each([
    ["a keyId with capitals", "Local-1"],
    ["a keyId over 32 characters", `k${"a".repeat(32)}`],
    ["a keyId starting with a dash", "-local"],
  ])("rejects %s", async (_label, keyId) => {
    const signer = freshSigner(keyId);
    expect(await verifyEnvelopeDetailed(signer.envelope("{}"), signer.publicKeys)).toMatchObject({
      ok: false,
      reason: "envelope",
    });
  });

  test("accepts a keyId of exactly 32 characters", async () => {
    const signer = freshSigner(`k${"a".repeat(31)}`);
    expect((await verifyEnvelopeDetailed(signer.envelope("{}"), signer.publicKeys)).ok).toBe(true);
  });

  test("accepts a payload of exactly 524,288 bytes", async () => {
    const signer = freshSigner();
    const payload = "é".repeat(262_144);
    expect(new TextEncoder().encode(payload).length).toBe(524_288);
    expect((await verifyEnvelopeDetailed(signer.envelope(payload), signer.publicKeys)).ok).toBe(
      true,
    );
  });

  test("rejects a payload over 524,288 UTF-8 bytes, counted in bytes", async () => {
    const signer = freshSigner();
    const ascii = signer.envelope("x".repeat(524_289));
    const twoByte = signer.envelope(`${"é".repeat(262_144)}x`);
    expect(await verifyEnvelopeDetailed(ascii, signer.publicKeys)).toMatchObject({
      ok: false,
      reason: "too_large",
    });
    expect(await verifyEnvelopeDetailed(twoByte, signer.publicKeys)).toMatchObject({
      ok: false,
      reason: "too_large",
    });
  });

  test("signs UTF-8 bytes: a payload with Cyrillic and a check mark verifies", async () => {
    const signer = freshSigner();
    const body = signer.envelope('{"name":"Мой бейдж ✓ café"}');
    expect((await verifyEnvelopeDetailed(body, signer.publicKeys)).ok).toBe(true);
  });

  test("reports a runtime without Ed25519 as reason crypto, and recovers", async () => {
    const signer = freshSigner();
    const body = signer.envelope("{}");
    const importKey = vi
      .spyOn(crypto.subtle, "importKey")
      .mockRejectedValue(new DOMException("Unrecognized name.", "NotSupportedError"));
    expect(await verifyEnvelopeDetailed(body, signer.publicKeys)).toMatchObject({
      ok: false,
      reason: "crypto",
    });
    importKey.mockRestore();
    expect((await verifyEnvelopeDetailed(body, signer.publicKeys)).ok).toBe(true);
  });

  test.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 1],
    ["a string", "payload"],
    ["an array", []],
    ["numbers for strings", { payload: 1, signature: 2, keyId: 3 }],
  ])("returns null for %s and never throws", async (_label, body) => {
    expect(await verifyEnvelope(body, keys)).toBeNull();
  });
});

describe("base64url", () => {
  test.each([
    ["", []],
    ["AA", [0]],
    ["AAE", [0, 1]],
    ["_-8", [255, 239]],
  ])("decodes %j", (text, bytes) => {
    expect(Array.from(decodeBase64Url(text) ?? [99])).toEqual(bytes);
  });

  test.each(["A", "AB", "AAF", "AA==", "A+A", "AA A", "é"])("refuses %j", (text) => {
    expect(decodeBase64Url(text)).toBeNull();
  });
});
