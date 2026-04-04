'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from './StatusBadge';
import type { Audit } from '@/lib/types';

export default function AuditList() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAudits();
    // Poll every 15 seconds for status updates
    const interval = setInterval(fetchAudits, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchAudits = async () => {
    try {
      const res = await fetch('/api/audits');
      const data = await res.json();
      if (data.success) {
        setAudits(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch audits:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: audits.length,
    pending: audits.filter((a) => a.status === 'pending_review').length,
    sentToday: audits.filter((a) => {
      if (!a.sent_at) return false;
      const today = new Date().toISOString().split('T')[0];
      return a.sent_at.startsWith(today);
    }).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading audits...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Total Submitted</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Pending Review</p>
          <p className="text-2xl font-semibold text-amber-600">{stats.pending}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Sent Today</p>
          <p className="text-2xl font-semibold text-green-600">{stats.sentToday}</p>
        </div>
      </div>

      {/* Audit list */}
      {audits.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No audits yet. Submissions from Google Forms will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Tier
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {audits.map((audit) => (
                <tr key={audit.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/${audit.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {audit.client_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{audit.client_email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      ${audit.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={audit.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(audit.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
