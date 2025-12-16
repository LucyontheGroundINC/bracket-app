// db/schema.ts
import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  varchar,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ---------- users ----------
   If you plan to mirror auth users into public.users, keep this.
   Otherwise you can remove this table and also remove the FK from brackets/scores.
*/
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniqEmail: uniqueIndex("users_email_uidx").on(t.email),
}));


/* ---------- tournaments ---------- */
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  isLockedManual: boolean("is_locked_manual").default(false),
  lockAt: timestamp("lock_at", { withTimezone: true }),
}, (t) => ({
  uniqNameYear: uniqueIndex("tournaments_name_year_uidx").on(t.name, t.year),
}));

/* ---------- teams ---------- */
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  seed: integer("seed"),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id),
}, (t) => ({
  uniqTeamPerTourney: uniqueIndex("teams_tournament_name_uidx").on(t.tournamentId, t.name),
}));

/* ---------- games ---------- */
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id),
  round: integer("round").notNull(),             // 1 = Round of 64, etc.
  gameIndex: integer("game_index").notNull(),    // order within the round
  teamAId: integer("team_a_id").references(() => teams.id),
  teamBId: integer("team_b_id").references(() => teams.id),
  winnerId: integer("winner_id").references(() => teams.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniqGameSlot: uniqueIndex("games_tournament_round_index_uidx")
    .on(t.tournamentId, t.round, t.gameIndex),
}));

/* ---------- scores (optional aggregate per user/tournament) ---------- */
export const scores = pgTable("scores", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(), // .references(() => users.id)  <-- add FK if you keep users table
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id),
  total: integer("total").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniqUserTourney: uniqueIndex("scores_user_tournament_uidx").on(t.userId, t.tournamentId),
}));

/* ---------- brackets ---------- */
export const brackets = pgTable("brackets", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(), // .references(() => users.id)  <-- add FK if you keep users table
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id),
  name: varchar("name", { length: 120 }).notNull(),
  totalPoints: integer("total_points").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  idxUser: uniqueIndex("brackets_user_name_per_tournament_uidx").on(t.userId, t.tournamentId, t.name),
}));

/* ---------- picks ---------- */
export const picks = pgTable("picks", {
  id: serial("id").primaryKey(),
  bracketId: integer("bracket_id").notNull().references(() => brackets.id, { onDelete: "cascade" }),
  gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  pickedTeamId: integer("picked_team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniqBracketGame: uniqueIndex("picks_bracket_game_uidx").on(t.bracketId, t.gameId),
}));


