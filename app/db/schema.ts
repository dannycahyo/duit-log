import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  onboardingComplete: boolean('onboarding_complete')
    .notNull()
    .default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// 1:1 relationship — each user has exactly one spreadsheet.
// The unique constraint on user_id enforces this at the DB level.
export const userSpreadsheets = pgTable('user_spreadsheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique() // One spreadsheet per user
    .references(() => users.id, { onDelete: 'cascade' }),
  spreadsheetId: text('spreadsheet_id').notNull(),
  spreadsheetUrl: text('spreadsheet_url'),
  spreadsheetTitle: text('spreadsheet_title'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userSources = pgTable('user_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  color: text('color').notNull(), // Tailwind color class, e.g. "blue-500"
  sortOrder: integer('sort_order').notNull().default(0),
});

export const userCategories = pgTable('user_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const userMethods = pgTable('user_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});
