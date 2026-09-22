import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";

// A "theme" is a selectable guessing category (brand logos, football club
// crests, movie posters, video game covers...). imageProvider says which
// adapter in artifacts/api-server/src/image-providers.ts resolves a
// catalog item's imageRef into an actual fetchable image URL.
export const themesTable = pgTable("themes", {
  id: text("id").primaryKey(),
  nameFr: text("name_fr").notNull(),
  nameEn: text("name_en").notNull(),
  imageProvider: text("image_provider").notNull(),
  aspectW: integer("aspect_w").notNull().default(1),
  aspectH: integer("aspect_h").notNull().default(1),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type Theme = typeof themesTable.$inferSelect;
export type NewTheme = typeof themesTable.$inferInsert;
