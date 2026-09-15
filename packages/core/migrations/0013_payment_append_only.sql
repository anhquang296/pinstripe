CREATE TRIGGER payment_attempts_append_only
  BEFORE UPDATE OR DELETE ON payment_attempts
  FOR EACH ROW EXECUTE FUNCTION ledger_reject_mutation();
--> statement-breakpoint

CREATE TRIGGER refunds_append_only
  BEFORE UPDATE OR DELETE ON refunds
  FOR EACH ROW EXECUTE FUNCTION ledger_reject_mutation();
