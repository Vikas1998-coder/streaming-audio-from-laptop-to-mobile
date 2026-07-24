CREATE TABLE "rooms" (
	"code" text PRIMARY KEY,
	"offer" jsonb,
	"answer" jsonb,
	"broadcaster_candidates" jsonb DEFAULT '[]' NOT NULL,
	"listener_candidates" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
