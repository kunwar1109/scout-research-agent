import { cookies } from 'next/headers';

/**
 * Anonymous per-browser ownership. proxy.ts gives every browser a random id cookie;
 * chats are stamped with it, so visitors only ever see their own history. Not auth:
 * clearing cookies starts a fresh, empty history.
 */
export const OWNER_COOKIE = 'scout_owner';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isOwnerId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** The current browser's owner id, or null if the cookie is missing or malformed. */
export async function getOwnerId() {
  const value = (await cookies()).get(OWNER_COOKIE)?.value;
  return isOwnerId(value) ? value : null;
}
