import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  code: text("code").primaryKey(),
  offer: jsonb("offer"),
  answer: jsonb("answer"),
  broadcasterCandidates: jsonb("broadcaster_candidates").notNull().default([]),
  listenerCandidates: jsonb("listener_candidates").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
