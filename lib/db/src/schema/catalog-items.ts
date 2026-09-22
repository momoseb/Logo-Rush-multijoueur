import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { themesTable } from "./themes";

// Replaces the old hardcoded `logos` array (artifacts/api-server/src/game.ts)
// and `brandSeeds` (logo-catalog.ts). `id` must be globally unique across
// all themes (round tokens carry it alongside themeId, but keeping ids
// unique on their own avoids any ambiguity) — see makeCatalogItemId below.
//
// answer/aliases are split FR/EN because club, movie and video game names
// are not reliably identical across languages (brand names mostly are —
// see AGENTS.md/the plan for why brands just mirror the same value in both
// columns). Guess matching accepts the union of both locales; only the
// *revealed* answer text is picked per the requesting client's locale.
export const catalogItemsTable = pgTable(
  "catalog_items",
  {
    id: text("id").primaryKey(),
    themeId: text("theme_id")
      .notNull()
      .references(() => themesTable.id),
    answerFr: text("answer_fr").notNull(),
    answerEn: text("answer_en").notNull(),
    aliasesFr: jsonb("aliases_fr").$type<string[]>().notNull().default([]),
    aliasesEn: jsonb("aliases_en").$type<string[]>().notNull().default([]),
    difficulty: text("difficulty").notNull().default("medium"),
    // Legacy free-text sub-tag inherited from the old brand catalog (e.g.
    // "sport", "mode"). Never filtered on — themeId is the filterable axis
    // now — kept only so the original per-brand categorization isn't lost.
    category: text("category"),
    imageRef: text("image_ref").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("catalog_items_theme_active_idx").on(table.themeId, table.active)],
);

export type CatalogItem = typeof catalogItemsTable.$inferSelect;
export type NewCatalogItem = typeof catalogItemsTable.$inferInsert;

// Keeps ids readable (useful in logs/admin) while guaranteeing uniqueness
// across themes, e.g. "brands:apple", "football-clubs:real-madrid".
export const makeCatalogItemId = (themeId: string, slug: string) => `${themeId}:${slug}`;
