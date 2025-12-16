CREATE TABLE "brackets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"tournament_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"total_points" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "avatar_url" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "picks" ADD COLUMN "bracket_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "picks" ADD COLUMN "picked_team_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_bracket_id_brackets_id_fk" FOREIGN KEY ("bracket_id") REFERENCES "public"."brackets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_picked_team_id_teams_id_fk" FOREIGN KEY ("picked_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "picks_bracket_game_uidx" ON "picks" USING btree ("bracket_id","game_id");--> statement-breakpoint
ALTER TABLE "picks" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "picks" DROP COLUMN "picked_team";