import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const logoReportsTable = pgTable(
  "logo_reports",
  {
    id: serial("id").primaryKey(),
    logoId: text("logo_id").notNull(),
    logoAnswer: text("logo_answer").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("logo_reports_logo_id_idx").on(table.logoId)],
);

export type LogoReport = typeof logoReportsTable.$inferSelect;
export type NewLogoReport = typeof logoReportsTable.$inferInsert;
