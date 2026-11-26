CREATE TABLE IF NOT EXISTS v6_profiles(member TEXT PRIMARY KEY REFERENCES members(id), public_id INTEGER UNIQUE NOT NULL, phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', district TEXT NOT NULL DEFAULT '');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS v6_activities(id INTEGER PRIMARY KEY AUTOINCREMENT, company TEXT NOT NULL, member TEXT NOT NULL, branch TEXT, page TEXT NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS v6_activities_company_id ON v6_activities(company,id DESC);
