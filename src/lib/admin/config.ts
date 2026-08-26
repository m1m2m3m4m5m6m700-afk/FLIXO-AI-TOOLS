const MIN_SESSION_SECRET_LENGTH = 32;

export function getAdminSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`ADMIN_SESSION_SECRET must be configured with at least ${MIN_SESSION_SECRET_LENGTH} characters.`);
  }
  return secret;
}
