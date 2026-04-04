'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import StatusBadge from './StatusBadge';
import ApproveButton from './ApproveButton';
import type { Audit, AuditStatus } from '@/lib/types';

export default function AuditDetail({ auditId }: { auditId: string }) {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [editedContent, setEditedContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch(`/api/audits/${auditId}`);
      const data = await res.json();
      if (data.success) {
        setAudit(data.data);
        if (!editedContent && data.data.audit_content) {
          setEditedContent(data.data.audit_content);
        }
      }
    } catch (err) {
      console.error('Failed to fetch audit:', err);
    } finally {
      setLoading(false);
    }
  }, [auditId, editedContent]);

  useEffect(() => {
    fetchAudit();
    // Poll while processing
    const interval = setInterval(() => {
      if (audit?.status === 'processing') {
        fetchAudit();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchAudit, audit?.status]);

  const handleStatusChange = (newStatus: AuditStatus) => {
    if (audit) {
      setAudit({ ...audit, status: newStatus });
    }
    if (newStatus === 'processing') {
      // Start polling
      const poll = setInterval(async () => {
        const res = await fetch(`/api/audits/${auditId}`);
        const data = await res.json();
        if (data.success && data.data.status !== 'processing') {
          setAudit(data.data);
          setEditedContent(data.data.audit_content || '');
          clearInterval(poll);
        }
      }, 5000);
    }
  };

  const getAuditContent = () => editedContent;

  const handleSave = async () => {
    try {
      await fetch(`/api/audits/${auditId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_content: editedContent }),
      });
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading audit...</p>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">Audit not found.</p>
        <Link href="/dashboard" className="mt-4 text-sm text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            &larr; Back
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{audit.client_name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-gray-500">${audit.tier} tier</span>
              <StatusBadge status={audit.status} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {audit.status === 'pending_review' && editedContent !== audit.audit_content && (
            <button
              onClick={handleSave}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Save Edits
            </button>
          )}
          <ApproveButton
            auditId={audit.id}
            status={audit.status}
            clientEmail={audit.client_email}
            getAuditContent={getAuditContent}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>

      {/* Error message */}
      {audit.status === 'error' && audit.error_message && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Generation Error</p>
          <p className="mt-1 text-sm text-red-600">{audit.error_message}</p>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-5 gap-6">
        {/* Left column — Intake data */}
        <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Intake Responses
          </h2>
          <div className="space-y-4">
            {Object.entries(audit.intake_json).map(([key, value]) => {
              if (!value || key === 'Timestamp') return null;
              return (
                <div key={key}>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    {key}
                  </p>
                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
                </div>
              );
            })}
            {audit.resume_url && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Resume
                </p>
                <a
                  href={audit.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-sm text-blue-600 hover:underline"
                >
                  View on Google Drive
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Audit content */}
        <div className="col-span-3 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Audit Content
          </h2>
          {audit.status === 'processing' ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
                <p className="text-sm text-gray-500">Generating audit with Claude...</p>
              </div>
            </div>
          ) : audit.audit_content || editedContent ? (
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              disabled={audit.status === 'sent'}
              className="h-[calc(100vh-280px)] w-full resize-none rounded-lg border border-gray-200 p-4 font-mono text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
            />
          ) : (
            <p className="py-20 text-center text-sm text-gray-400">No content yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
