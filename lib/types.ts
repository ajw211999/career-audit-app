export type AuditStatus = 'processing' | 'pending_review' | 'approved' | 'sent' | 'error';

export type AuditTier = '79' | '149';

export interface Audit {
  id: string;
  client_name: string;
  client_email: string;
  tier: AuditTier;
  status: AuditStatus;
  intake_json: Record<string, string>;
  resume_url: string | null;
  resume_file_base64: string | null;
  resume_mime_type: string | null;
  resume_filename: string | null;
  audit_content: string | null;
  error_message: string | null;
  created_at: string;
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
