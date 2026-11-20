import type { AuthResult, LoginInput, RegistrationInput } from "./generated/api.schemas";

/**
 * Shared signup sequence for web and native clients. Registration remains
 * enumeration-safe; the same submitted credentials are then used for login.
 */
export async function registerAndSignInCitizen(options: {
  credentials: RegistrationInput;
  register: (data: RegistrationInput) => Promise<unknown>;
  login: (data: LoginInput) => Promise<AuthResult>;
  acceptSession: (result: AuthResult) => Promise<unknown>;
}): Promise<AuthResult> {
  const { credentials, register, login, acceptSession } = options;
  await register(credentials);
  const result = await login({ email: credentials.email, password: credentials.password });
  if (result.user.role !== "citizen") {
    throw new Error("Public registration can only sign in citizen accounts.");
  }
  await acceptSession(result);
  return result;
}
