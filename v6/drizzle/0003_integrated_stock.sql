ALTER TABLE v6_team ADD COLUMN branch TEXT;
--> statement-breakpoint
ALTER TABLE v6_invites ADD COLUMN branch TEXT;
--> statement-breakpoint
CREATE TABLE v6_inventory (company TEXT PRIMARY KEY REFERENCES v6_companies(id), revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
