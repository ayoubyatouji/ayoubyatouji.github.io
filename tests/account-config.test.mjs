import assert from "node:assert/strict";
import test from "node:test";
import { validatePublicSupabaseConfig } from "../account.js";

test("Supabase account config requires a valid HTTP(S) URL and a public key", () => {
  assert.deepEqual(validatePublicSupabaseConfig({ url: "", publishableKey: "" }), { error: "missing" });
  assert.deepEqual(
    validatePublicSupabaseConfig({ url: "javascript:alert(1)", publishableKey: "public-key" }),
    { error: "invalid" }
  );
  assert.deepEqual(
    validatePublicSupabaseConfig({ url: "http://example.supabase.co", publishableKey: "public-key" }),
    { error: "invalid" }
  );
  assert.deepEqual(
    validatePublicSupabaseConfig({ url: "https://example.test/project", publishableKey: "public-key" }),
    { error: "invalid" }
  );
});

test("Supabase account config accepts public keys and rejects service-role secrets", () => {
  assert.deepEqual(
    validatePublicSupabaseConfig({
      url: "https://example.supabase.co/",
      publishableKey: "sb_publishable_public"
    }),
    { url: "https://example.supabase.co", publicKey: "sb_publishable_public" }
  );

  const serviceRolePayload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  assert.deepEqual(
    validatePublicSupabaseConfig({
      url: "https://example.supabase.co",
      publishableKey: `header.${serviceRolePayload}.signature`
    }),
    { error: "unsafe" }
  );
  assert.deepEqual(
    validatePublicSupabaseConfig({
      url: "https://example.supabase.co",
      publishableKey: "sb_secret_never-use-this"
    }),
    { error: "unsafe" }
  );
  assert.deepEqual(
    validatePublicSupabaseConfig({
      url: "http://127.0.0.1:54321",
      anonKey: "legacy-public-anon-key"
    }),
    { url: "http://127.0.0.1:54321", publicKey: "legacy-public-anon-key" }
  );
});
