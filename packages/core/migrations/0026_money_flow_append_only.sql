CREATE TRIGGER refund_transitions_append_only
  BEFORE UPDATE OR DELETE ON refund_transitions
  FOR EACH ROW EXECUTE FUNCTION ledger_reject_mutation();
--> statement-breakpoint

CREATE TRIGGER credit_note_transitions_append_only
  BEFORE UPDATE OR DELETE ON credit_note_transitions
  FOR EACH ROW EXECUTE FUNCTION ledger_reject_mutation();
--> statement-breakpoint

CREATE TRIGGER credit_note_line_items_append_only
  BEFORE UPDATE OR DELETE ON credit_note_line_items
  FOR EACH ROW EXECUTE FUNCTION ledger_reject_mutation();
