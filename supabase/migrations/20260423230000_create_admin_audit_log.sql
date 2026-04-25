-- VULN-012 Fix: Admin Audit Trail
-- Create admin_audit_log table for immutable audit trail

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    admin_user_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    details JSONB,
    before_state JSONB,
    after_state JSONB,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_audit_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX idx_audit_action ON admin_audit_log(action);
CREATE INDEX idx_audit_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_timestamp ON admin_audit_log(timestamp DESC);
CREATE INDEX idx_audit_success ON admin_audit_log(success) WHERE NOT success;

-- Prevent updates and deletes (append-only for integrity)
-- This is enforced at application level, but can also be done via trigger
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_audit_update
    BEFORE UPDATE ON admin_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER no_audit_delete
    BEFORE DELETE ON admin_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- Comments
COMMENT ON TABLE admin_audit_log IS 'Immutable audit trail for all admin/sensitive actions. Append-only - no updates or deletes allowed.';
COMMENT ON COLUMN admin_audit_log.action IS 'Action type (e.g., queue_pause, job_cancel, config_change)';
COMMENT ON COLUMN admin_audit_log.admin_user_id IS 'UUID of the admin user who performed the action';
COMMENT ON COLUMN admin_audit_log.resource_type IS 'Type of resource affected (job, queue, config, admin_endpoint)';
COMMENT ON COLUMN admin_audit_log.resource_id IS 'ID of the affected resource';
COMMENT ON COLUMN admin_audit_log.ip_address IS 'IP address of the admin at time of action';
COMMENT ON COLUMN admin_audit_log.details IS 'Additional context about the action in JSON format';
COMMENT ON COLUMN admin_audit_log.before_state IS 'State before the change (for mutations)';
COMMENT ON COLUMN admin_audit_log.after_state IS 'State after the change (for mutations)';
COMMENT ON COLUMN admin_audit_log.success IS 'Whether the action succeeded';
COMMENT ON COLUMN admin_audit_log.error_message IS 'Error message if action failed';