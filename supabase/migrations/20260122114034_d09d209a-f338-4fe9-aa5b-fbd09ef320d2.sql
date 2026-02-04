-- Feature 1: OTP + Magic Link Authentication Settings
-- Feature 3: Daily Free Credits Setting
-- Feature 4: Per-Page Maintenance
-- Feature 5: Scheduled Maintenance
-- Feature 6: Notification Attachments
-- Feature 7: Invoice System

-- Insert auth settings into system_settings
INSERT INTO system_settings (key, value, description) VALUES
  ('otp_auth_enabled', 'false', 'Enable OTP email authentication'),
  ('magic_link_enabled', 'false', 'Enable magic link passwordless authentication'),
  ('daily_free_credits', '10', 'Default daily free credits for users'),
  ('default_rpm', '60', 'Default requests per minute rate limit'),
  ('default_rpd', '1000', 'Default requests per day rate limit'),
  ('maintenance_pages', '[]', 'JSON array of pages affected by maintenance mode'),
  ('scheduled_maintenance_start', 'null', 'Scheduled maintenance start time (ISO string or null)'),
  ('scheduled_maintenance_end', 'null', 'Scheduled maintenance end time (ISO string or null)')
ON CONFLICT (key) DO NOTHING;

-- Add attachment_url column to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS attachment_name text;

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_number text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  description text,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  file_url text,
  file_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CONSTRAINT invoices_status_check CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled'))
);

-- Enable RLS on invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Users can view their own invoices"
  ON invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all invoices"
  ON invoices FOR SELECT
  USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can insert invoices"
  ON invoices FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update invoices"
  ON invoices FOR UPDATE
  USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can delete invoices"
  ON invoices FOR DELETE
  USING (is_admin_or_above(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for notification attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('notification-attachments', 'notification-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-files', 'invoice-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for notification-attachments bucket
CREATE POLICY "Admins can upload notification attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'notification-attachments' 
    AND is_admin_or_above(auth.uid())
  );

CREATE POLICY "Users can view their notification attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'notification-attachments'
    AND (
      is_admin_or_above(auth.uid())
      OR EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.attachment_url LIKE '%' || name 
        AND n.user_id = auth.uid()
      )
    )
  );

-- Storage policies for invoice-files bucket
CREATE POLICY "Admins can upload invoice files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoice-files' 
    AND is_admin_or_above(auth.uid())
  );

CREATE POLICY "Users can view their invoice files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoice-files'
    AND (
      is_admin_or_above(auth.uid())
      OR EXISTS (
        SELECT 1 FROM invoices i 
        WHERE i.file_url LIKE '%' || name 
        AND i.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can delete invoice files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'invoice-files' 
    AND is_admin_or_above(auth.uid())
  );

CREATE POLICY "Admins can delete notification attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'notification-attachments' 
    AND is_admin_or_above(auth.uid())
  );