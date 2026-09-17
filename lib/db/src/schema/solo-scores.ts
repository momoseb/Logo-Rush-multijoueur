import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const soloScoresTable = pgTable(
  "solo_scores",
  {
    id: serial("id").primaryKey(),
    nickname: text("nickname").notNull(),
    score: integer("score").notNull(),
    roundCount: integer("round_count").notNull(),
    roundDuration: integer("round_duration").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("solo_scores_mode_score_idx").on(
      table.roundCount,
      table.roundDuration,
      table.score,
    ),
  ],
);

export type SoloScore = typeof soloScoresTable.$inferSelect;
export type NewSoloScore = typeof soloScoresTable.$inferInsert;