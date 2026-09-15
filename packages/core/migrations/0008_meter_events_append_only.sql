CREATE TRIGGER meter_events_append_only
  BEFORE UPDATE OR DELETE ON meter_events
  FOR EACH ROW EXECUTE FUNCTION ledger_reject_mutation();
