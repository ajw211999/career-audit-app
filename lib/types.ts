export type AuditStatus =
  | 'draft'
  | 'submitted'
  | 'needs_info'
  | 'processing'
  | 'pending_review'
  | 'approved'
  | 'sent'
  | 'error';

export type AuditTier = '197' | '497' | 'snapshot';

export interface Audit {
  id: string;
  client_name: string;
  client_email: string;
  tier: AuditTier;
  status: AuditStatus;
  intake_json: Record<string, string>;
  intake_token: string | null;
  kajabi_transaction_id: string | null;
  generation_count: number;
  crisis_flag: boolean;
  reminder_count: number;
  last_reminder_at: string | null;
  resume_url: string | null;
  resume_file_base64: string | null;
  resume_mime_type: string | null;
  resume_filename: string | null;
  audit_content: string | null;
  error_message: string | null;
  created_at: string;
  paid_at: string | null;
  submitted_at: string | null;
  processed_at: string | null;
  approved_at: string | null;
  sent_at: string | null;
}

export interface IntakePayload {
  secret: string;
  timestamp: string;
  formData: Record<string, string>;
  resumeUrl: string | null;
  resumeFileBase64: string | null;
  resumeMimeType: string | null;
  resumeFilename: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** One question in the Snapshot intake form. */
export interface SnapshotQuestion {
  id: string;
  section: string;
  label: string;
  help?: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'scale';
  options?: string[];
  required: boolean;
  /** Minimum characters for free-text answers (thin-answer guard). */
  minLength?: number;
  placeholder?: string;
}
