-- Ledger rows are append-only: a posted transaction and its postings can never be
-- updated or deleted. Corrections are made by posting a reversing transaction.
CREATE OR REPLACE FUNCTION ledger_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger rows are append-only: % on % is not allowed, post a reversing transaction instead', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_postings_append_only
  BEFORE UPDATE OR DELETE ON ledger_postings
  FOR EACH ROW EXECUTE FUNCTION ledger_reject_mutation();

CREATE TRIGGER ledger_transactions_append_only
  BEFORE DELETE ON ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION ledger_reject_mutation();

-- The reversal link is the one column a posted transaction is allowed to gain, and
-- only once: everything else stays exactly as it was written.
CREATE OR REPLACE FUNCTION ledger_transactions_reject_mutation() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_transactions_reversal_only
  BEFORE UPDATE ON ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION ledger_transactions_reject_mutation();

-- Balances are a projection over the postings, never a stored column.
CREATE VIEW ledger_account_balances AS
SELECT
  a.id AS account_id,
  COALESCE(SUM(CASE WHEN p.direction = 'debit' THEN p.amount ELSE 0 END), 0)::bigint AS debits,
  COALESCE(SUM(CASE WHEN p.direction = 'credit' THEN p.amount ELSE 0 END), 0)::bigint AS credits,
  CASE
    WHEN a.normal_balance = 'debit'
      THEN COALESCE(SUM(CASE WHEN p.direction = 'debit' THEN p.amount ELSE -p.amount END), 0)
    ELSE COALESCE(SUM(CASE WHEN p.direction = 'credit' THEN p.amount ELSE -p.amount END), 0)
  END::bigint AS balance
FROM ledger_accounts a
LEFT JOIN ledger_postings p ON p.account_id = a.id
GROUP BY a.id, a.normal_balance;
