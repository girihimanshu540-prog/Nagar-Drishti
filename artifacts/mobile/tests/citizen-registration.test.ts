import test from "node:test";
import assert from "node:assert/strict";
import { registerAndSignInCitizen } from "@workspace/api-client-react";
import type { AuthResult, RegistrationInput } from "@workspace/api-client-react";

const credentials: RegistrationInput = {
  name: "New Citizen",
  email: "new-citizen@example.invalid",
  password: "StrongCitizenPassword2026!",
};

const citizenSession = {
  user: { id: 42, name: credentials.name, email: credentials.email, role: "citizen" as const, ward_id: 1 },
  access_token: "test-session-token",
} satisfies AuthResult;

for (const platform of ["web", "mobile"]) {
  test(`${platform} signup creates a citizen, signs in, and accepts the session`, async () => {
    const events: string[] = [];
    const accepted: AuthResult[] = [];
    const result = await registerAndSignInCitizen({
      credentials,
      register: async (data) => {
        events.push("register");
        assert.deepEqual(data, credentials);
        assert.equal("role" in data, false);
        return { message: "registration complete" };
      },
      login: async (data) => {
        events.push("login");
        assert.deepEqual(data, { email: credentials.email, password: credentials.password });
        return citizenSession;
      },
      acceptSession: async (session) => {
        events.push("accept");
        accepted.push(session);
      },
    });

    assert.deepEqual(events, ["register", "login", "accept"]);
    assert.equal(result.user.role, "citizen");
    assert.deepEqual(accepted, [citizenSession]);
  });
}

test("failed signup does not attempt sign-in or accept a session", async () => {
  const events: string[] = [];
  await assert.rejects(registerAndSignInCitizen({
    credentials,
    register: async () => { events.push("register"); throw new Error("registration failed"); },
    login: async () => { events.push("login"); return citizenSession; },
    acceptSession: async () => { events.push("accept"); },
  }), /registration failed/);
  assert.deepEqual(events, ["register"]);
});

test("signup flow refuses to accept a staff session", async () => {
  const staffSession = {
    ...citizenSession,
    user: { ...citizenSession.user, role: "commissioner" as const },
  };
  let accepted = false;
  await assert.rejects(registerAndSignInCitizen({
    credentials,
    register: async () => undefined,
    login: async () => staffSession,
    acceptSession: async () => { accepted = true; },
  }), /only sign in citizen accounts/);
  assert.equal(accepted, false);
});
