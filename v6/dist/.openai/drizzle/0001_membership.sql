CREATE TABLE IF NOT EXISTS v6_companies(id TEXT PRIMARY KEY, name TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS v6_team(member TEXT PRIMARY KEY REFERENCES members(id), company TEXT NOT NULL REFERENCES v6_companies(id), role TEXT NOT NULL CHECK(role IN ('owner','manager','employee')));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS v6_invites(token TEXT PRIMARY KEY, company TEXT NOT NULL REFERENCES v6_companies(id), email TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('manager','employee')), expires INTEGER NOT NULL);
