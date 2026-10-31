// Readers for the shared fixtures in test/fixtures/contract-v1/.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// From the repo root (vitest's root, the working directory) rather than
// import.meta.url, which is not a file URL under a DOM test environment.
export const FIXTURES = pathToFileURL(`${resolve("test/fixtures/contract-v1")}/`);

export interface Vector {
  keyId: string;
  seed: string;
  publicKey: string;
  emptyMessageSignature: string;
  payload: string;
  payloadBytes: number;
  signature: string;
  envelope: string;
}

export interface WallFixture {
  file: string;
  name: string;
  now: string;
  project: string;
  payload: string;
  expect: { ok: boolean; reason?: string; ids: Array<string | null>; skipped: number };
}

export interface EnvelopeFixture {
  file: string;
  name: string;
  project: string;
  now: string;
  publicKeys: Record<string, string>;
  body: string;
  expect: { ok: boolean; reason?: string };
}

export function readFixture(path: string): string {
  return readFileSync(new URL(path, FIXTURES), "utf8");
}

export function vector(): Vector {
  return JSON.parse(readFixture("vector.json")) as Vector;
}

function jsonFiles(dir: string): string[] {
  return readdirSync(new URL(`${dir}/`, FIXTURES))
    .filter((file) => file.endsWith(".json"))
    .sort();
}

export function wallFixtures(): WallFixture[] {
  return jsonFiles("walls").map((file) => ({
    file,
    ...(JSON.parse(readFixture(`walls/${file}`)) as Omit<WallFixture, "file">),
  }));
}

export function envelopeFixtures(): EnvelopeFixture[] {
  return jsonFiles("envelopes").map((file) => ({
    file,
    ...(JSON.parse(readFixture(`envelopes/${file}`)) as Omit<EnvelopeFixture, "file">),
  }));
}

/** The publicKeys option a local backend signing with the test key needs. */
export function testKeys(): Record<string, string> {
  const { keyId, publicKey } = vector();
  return { [keyId]: publicKey };
}
