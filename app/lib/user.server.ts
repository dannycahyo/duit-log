import { db } from "~/db/index.server";
import {
  users,
  userSources,
  userCategories,
  userMethods,
  userSpreadsheets,
} from "~/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get or create a user record from a Clerk user ID.
 * Called on every authenticated request (via the _app layout loader).
 */
export async function getOrCreateUser(
  clerkId: string,
  email: string,
  name?: string,
  avatarUrl?: string
) {
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  if (existing) return existing;

  const [newUser] = await db
    .insert(users)
    .values({
      clerkId,
      email,
      name: name ?? null,
      avatarUrl: avatarUrl ?? null,
    })
    .onConflictDoNothing({ target: users.clerkId })
    .returning();

  if (newUser) return newUser;

  // If another concurrent request inserted the user first, fetch it now.
  return await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });
}

/**
 * Get the full user config (spreadsheet, sources, categories, methods).
 */
export async function getUserConfig(userId: string) {
  const [spreadsheet, sources, categories, methods] = await Promise.all([
    db.query.userSpreadsheets.findFirst({
      where: eq(userSpreadsheets.userId, userId),
    }),
    db.query.userSources.findMany({
      where: eq(userSources.userId, userId),
      orderBy: (s, { asc }) => [asc(s.sortOrder)],
    }),
    db.query.userCategories.findMany({
      where: eq(userCategories.userId, userId),
      orderBy: (c, { asc }) => [asc(c.sortOrder)],
    }),
    db.query.userMethods.findMany({
      where: eq(userMethods.userId, userId),
      orderBy: (m, { asc }) => [asc(m.sortOrder)],
    }),
  ]);

  return { spreadsheet, sources, categories, methods };
}
