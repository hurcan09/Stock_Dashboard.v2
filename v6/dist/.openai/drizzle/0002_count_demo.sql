CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,name TEXT NOT NULL);
--> statement-breakpoint
    CREATE TABLE IF NOT EXISTS branches(id TEXT PRIMARY KEY,company TEXT NOT NULL REFERENCES companies,name TEXT NOT NULL,region TEXT NOT NULL,UNIQUE(company,name));
--> statement-breakpoint
    CREATE TABLE IF NOT EXISTS memberships(member TEXT PRIMARY KEY,company TEXT NOT NULL REFERENCES companies,branch TEXT REFERENCES branches,name TEXT NOT NULL,email TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','manager','employee')));
--> statement-breakpoint
    CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY,company TEXT NOT NULL REFERENCES companies,branch TEXT NOT NULL REFERENCES branches,email TEXT NOT NULL,role TEXT NOT NULL,expires INTEGER NOT NULL);
--> statement-breakpoint
    CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,branch TEXT NOT NULL REFERENCES branches,name TEXT NOT NULL,sku TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>=0),UNIQUE(branch,sku));
--> statement-breakpoint
    CREATE TABLE IF NOT EXISTS counts(id TEXT PRIMARY KEY,branch TEXT NOT NULL REFERENCES branches,product TEXT NOT NULL REFERENCES products,author TEXT NOT NULL REFERENCES memberships,expected INTEGER NOT NULL,actual INTEGER NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER update_stock_after_count AFTER INSERT ON counts
BEGIN
 UPDATE products SET quantity=NEW.actual WHERE id=NEW.product;
END;
