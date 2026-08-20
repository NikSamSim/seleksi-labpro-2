CREATE UNIQUE INDEX "event_deliveries_event_id_application_id_unique" ON "event_deliveries" USING btree ("event_id","application_id");--> statement-breakpoint
CREATE INDEX "event_deliveries_event_id_idx" ON "event_deliveries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_deliveries_status_next_retry_at_idx" ON "event_deliveries" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "events_status_published_at_created_at_idx" ON "events" USING btree ("status","published_at","created_at");