CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"round" integer NOT NULL,
	"region" varchar(24),
	"seed_a" integer,
	"seed_b" integer,
	"team_a" varchar(80),
	"team_b" varchar(80),
	"winner" varchar(80)
);
--> statement-breakpoint
CREATE TABLE "picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"game_id" integer NOT NULL,
	"picked_team" varchar(80) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"tournament_id" integer NOT NULL,
	"total" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"is_locked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"display_name" varchar(120),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "example" CASCADE;