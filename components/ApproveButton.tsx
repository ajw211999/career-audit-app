'use client';

import { useState } from 'react';
import type { AuditStatus } from '@/lib/types';

interface ApproveButtonProps {
  auditId: string;
  status: AuditStatus;
  clientEmail: string;
  getAuditContent: () => string;
  onStatusChange: (status: AuditStatus) => void;
}

export default function ApproveButton({
  auditId,
  status,
  clientEmail,
  getAuditContent,
  onStatusChange,
}: ApproveButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    setShowConfirm(false);

    try {
      const res = await fetch(`/api/audits/${auditId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditContent: getAuditContent() }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to send audit');
        return;
      }

      onStatusChange('sent');
    } catch {
      alert('Failed to send audit. Check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/retry`, {
        method: 'POST',
      });

      if (res.ok) {
        onStatusChange('processing');
      } else {
        alert('Retry failed.');
      }
    } catch {
      alert('Retry failed.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'sent') {
    return (
      <button
        disabled
        className="rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-800 cursor-not-allowed"
      >
        Sent
      </button>
    );
  }

  if (status === 'processing') {
    return (
      <button
        disabled
        className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500 cursor-not-allowed"
      >
        Generating...
      </button>
    );
  }

  if (status === 'error') {
    return (
      <button
        onClick={handleRetry}
        disabled={loading}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? 'Retrying...' : 'Retry Generation'}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={loading}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Approve + Send'}
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Confirm Send</h3>
            <p className="mt-2 text-sm text-gray-600">
              Send to <strong>{clientEmail}</strong>? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Yes, Send It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
