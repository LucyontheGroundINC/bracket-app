CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"seed" integer,
	"tournament_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "game_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "team_a_id" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "team_b_id" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "winner_id" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "year" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_team_a_id_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_team_b_id_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_winner_id_teams_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "region";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "seed_a";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "seed_b";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "team_a";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "team_b";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "winner";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "is_locked";