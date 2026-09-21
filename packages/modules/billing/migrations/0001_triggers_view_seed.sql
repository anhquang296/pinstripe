CREATE FUNCTION billing.ledger_reject_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'ledger rows are append-only: % on % is not allowed, post a reversing transaction instead', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE FUNCTION billing.ledger_transactions_reject_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.reversed_by_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'ledger transaction % is already reversed', OLD.id USING ERRCODE = '23514';
  END IF;

  IF ROW(NEW.id, NEW.description, NEW.currency, NEW.external_id, NEW.effective_at, NEW.reverses_transaction_id, NEW.metadata, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.description, OLD.currency, OLD.external_id, OLD.effective_at, OLD.reverses_transaction_id, OLD.metadata, OLD.created_at) THEN
    RAISE EXCEPTION 'ledger transactions are append-only: only reversed_by_transaction_id may be set'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION billing.invoices_reject_issued_rewrite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.number IS DISTINCT FROM OLD.number
     OR NEW.total IS DISTINCT FROM OLD.total
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.subtotal_excluding_tax IS DISTINCT FROM OLD.subtotal_excluding_tax
     OR NEW.total_discount_amount IS DISTINCT FROM OLD.total_discount_amount
     OR NEW.total_tax_amount IS DISTINCT FROM OLD.total_tax_amount
     OR NEW.starting_balance IS DISTINCT FROM OLD.starting_balance
     OR NEW.ending_balance IS DISTINCT FROM OLD.ending_balance
     OR NEW.amount_due IS DISTINCT FROM OLD.amount_due
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at THEN
    RAISE EXCEPTION 'invoice % has been issued and its billed content is immutable', OLD.id;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER credit_note_line_items_append_only BEFORE DELETE OR UPDATE ON billing.credit_note_line_items FOR EACH ROW EXECUTE FUNCTION billing.ledger_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER credit_note_transitions_append_only BEFORE DELETE OR UPDATE ON billing.credit_note_transitions FOR EACH ROW EXECUTE FUNCTION billing.ledger_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER credit_notes_append_only BEFORE DELETE OR UPDATE ON billing.credit_notes FOR EACH ROW EXECUTE FUNCTION billing.ledger_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER invoice_line_items_append_only BEFORE DELETE OR UPDATE ON billing.invoice_line_items FOR EACH ROW EXECUTE FUNCTION billing.ledger_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER invoices_issued_immutable BEFORE UPDATE ON billing.invoices FOR EACH ROW EXECUTE FUNCTION billing.invoices_reject_issued_rewrite();
--> statement-breakpoint
CREATE TRIGGER invoices_no_delete BEFORE DELETE ON billing.invoices FOR EACH ROW EXECUTE FUNCTION billing.ledger_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER ledger_postings_append_only BEFORE DELETE OR UPDATE ON billing.ledger_postings FOR EACH ROW EXECUTE FUNCTION billing.ledger_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER ledger_transactions_append_only BEFORE DELETE ON billing.ledger_transactions FOR EACH ROW EXECUTE FUNCTION billing.ledger_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER ledger_transactions_reversal_only BEFORE UPDATE ON billing.ledger_transactions FOR EACH ROW EXECUTE FUNCTION billing.ledger_transactions_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER meter_events_append_only BEFORE DELETE OR UPDATE ON billing.meter_events FOR EACH ROW EXECUTE FUNCTION billing.ledger_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER refund_transitions_append_only BEFORE DELETE OR UPDATE ON billing.refund_transitions FOR EACH ROW EXECUTE FUNCTION billing.ledger_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER refunds_append_only BEFORE DELETE OR UPDATE ON billing.refunds FOR EACH ROW EXECUTE FUNCTION billing.ledger_reject_mutation();
--> statement-breakpoint
CREATE VIEW billing.ledger_account_balances AS
 SELECT a.id AS account_id,
    (COALESCE(sum(
        CASE
            WHEN (p.direction = 'debit'::text) THEN p.amount
            ELSE (0)::bigint
        END), (0)::numeric))::bigint AS debits,
    (COALESCE(sum(
        CASE
            WHEN (p.direction = 'credit'::text) THEN p.amount
            ELSE (0)::bigint
        END), (0)::numeric))::bigint AS credits,
    (
        CASE
            WHEN (a.normal_balance = 'debit'::text) THEN COALESCE(sum(
            CASE
                WHEN (p.direction = 'debit'::text) THEN p.amount
                ELSE (- p.amount)
            END), (0)::numeric)
            ELSE COALESCE(sum(
            CASE
                WHEN (p.direction = 'credit'::text) THEN p.amount
                ELSE (- p.amount)
            END), (0)::numeric)
        END)::bigint AS balance
   FROM (billing.ledger_accounts a
     LEFT JOIN billing.ledger_postings p ON ((p.account_id = a.id)))
  GROUP BY a.id, a.normal_balance;
--> statement-breakpoint
INSERT INTO billing.number_sequences (name, next_value)
VALUES ('invoice', 1), ('credit_note', 1)
ON CONFLICT (name) DO NOTHING;
