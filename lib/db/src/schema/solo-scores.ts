import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const soloScoresTable = pgTable(
  "solo_scores",
  {
    id: serial("id").primaryKey(),
    nickname: text("nickname").notNull(),
    score: integer("score").notNull(),
    // Defaults to "brands" so `drizzle-kit push` can add this column to a
    // table that already has rows (all pre-existing scores were "brands").
    themeId: text("theme_id").notNull().default("brands"),
    roundCount: integer("round_count").notNull(),
    roundDuration: integer("round_duration").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("solo_scores_mode_score_idx").on(
      table.themeId,
      table.roundCount,
      table.roundDuration,
      table.score,
    ),
  ],
);

export type SoloScore = typeof soloScoresTable.$inferSelect;
export type NewSoloScore = typeof soloScoresTable.$inferInsert;