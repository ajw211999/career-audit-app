'use client';

import type { AuditStatus } from '@/lib/types';

const statusConfig: Record<AuditStatus, { label: string; className: string }> = {
  processing: {
    label: 'Processing',
    className: 'bg-gray-100 text-gray-700',
  },
  pending_review: {
    label: 'Pending Review',
    className: 'bg-amber-100 text-amber-800',
  },
  approved: {
    label: 'Approved',
    className: 'bg-blue-100 text-blue-800',
  },
  sent: {
    label: 'Sent',
    className: 'bg-green-100 text-green-800',
  },
  error: {
    label: 'Error',
    className: 'bg-red-100 text-red-800',
  },
};

export default function StatusBadge({ status }: { status: AuditStatus }) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
