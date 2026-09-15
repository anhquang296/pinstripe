INSERT INTO number_sequences (name, next_value)
VALUES ('invoice', 1), ('credit_note', 1)
ON CONFLICT (name) DO NOTHING;
--> statement-breakpoint

CREATE TRIGGER invoice_line_items_append_only
  BEFORE UPDATE OR DELETE ON invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION ledger_reject_mutation();
--> statement-breakpoint

CREATE TRIGGER credit_notes_append_only
  BEFORE UPDATE OR DELETE ON credit_notes
  FOR EACH ROW EXECUTE FUNCTION ledger_reject_mutation();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION invoices_reject_issued_rewrite() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.number IS DISTINCT FROM OLD.number
     OR NEW.total IS DISTINCT FROM OLD.total
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at THEN
    RAISE EXCEPTION 'invoice % has been issued and its billed content is immutable', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER invoices_issued_immutable
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoices_reject_issued_rewrite();
--> statement-breakpoint

CREATE TRIGGER invoices_no_delete
  BEFORE DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION ledger_reject_mutation();
