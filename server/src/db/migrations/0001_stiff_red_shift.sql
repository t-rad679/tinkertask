DROP INDEX "scopes_sibling_lower_name_uniq";--> statement-breakpoint
CREATE UNIQUE INDEX "scopes_root_lower_name_uniq" ON "scopes" USING btree ("user_id",lower("name")) WHERE "scopes"."deleted_at" IS NULL AND "scopes"."parent_id" IS NULL;--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scopes_sibling_lower_name_uniq" ON "scopes" USING btree ("user_id","parent_id",lower("name")) WHERE "scopes"."deleted_at" IS NULL AND "scopes"."parent_id" IS NOT NULL;