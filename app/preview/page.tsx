'use client';

import { useState } from 'react';

type AuditStatus = 'processing' | 'pending_review' | 'approved' | 'sent' | 'error';

const statusConfig: Record<AuditStatus, { label: string; className: string }> = {
  processing: { label: 'Processing', className: 'bg-gray-100 text-gray-700' },
  pending_review: { label: 'Pending Review', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800' },
  sent: { label: 'Sent', className: 'bg-green-100 text-green-800' },
  error: { label: 'Error', className: 'bg-red-100 text-red-800' },
};

const mockAudits = [
  {
    id: '1',
    client_name: 'Sarah Mitchell',
    client_email: 'sarah.mitchell@gmail.com',
    tier: '149' as const,
    status: 'pending_review' as AuditStatus,
    created_at: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
    audit_content: `## Executive Summary

Sarah Mitchell is a mid-career marketing director with 6 years at a Fortune 500 CPG company, currently earning $145K base + 20% bonus. She has strong brand management fundamentals but is underleveled relative to her scope of work — managing a $12M media budget and a team of 4 without the VP title or compensation that typically accompanies that responsibility.

Her positioning challenge is clear: she's operating at VP level but being paid and titled at Director level. This creates both urgency (she's leaving value on the table every quarter she stays) and leverage (she can demonstrate VP-level impact with concrete metrics).

The market is favorable for her move. CMO tenure at mid-market companies averages 18 months, creating constant downstream demand for senior marketing leaders. Her CPG background translates well to DTC, retail, and food/beverage sectors where brand-building skills command premium compensation.

## Current Position Analysis

### Strengths
- **Quantifiable brand impact**: Grew brand awareness from 34% to 52% in 18 months (verifiable via brand tracking studies)
- **P&L ownership**: Full accountability for $12M annual media budget with documented 3.2x ROAS improvement
- **Team leadership**: Built and manages team of 4 (2 managers, 2 coordinators) — reorganized structure that reduced agency dependency by 40%
- **Cross-functional credibility**: Led product launch that generated $8.2M in first-year revenue, coordinating across R&D, sales, and supply chain

### Gaps
- **Title deflation**: "Director" title undersells her actual scope — needs to be addressed in positioning
- **Digital depth**: Strong in traditional brand marketing but LinkedIn profile underrepresents her digital/performance marketing experience
- **Executive visibility**: No conference speaking, published thought leadership, or industry award nominations despite strong results

### Market Positioning
Current comp of $145K + 20% bonus ($174K total) is 15-20% below market for the scope she manages. VP Marketing roles at mid-market companies ($100M-$500M revenue) in her target markets pay $180K-$220K base + 25-30% bonus.

## Target Role Recommendations

### Role 1: VP of Marketing — Mid-Market DTC Brand ($200M-$500M revenue)
**Why this fits**: Her CPG brand-building skills are the exact gap most DTC companies face as they mature past the performance-marketing-only phase. Companies like Liquid Death, Athletic Greens, and Olipop are actively building traditional brand functions.

**Target comp**: $195K-$215K base + 25% bonus + equity
**Probability of landing in 90 days**: High

### Role 2: Head of Brand Marketing — Growth-Stage Tech Company
**Why this fits**: Series C-D tech companies are increasingly hiring brand marketers from CPG to build brand moats. Her media budget management and team-building experience directly transfers.

**Target comp**: $185K-$210K base + equity (potentially significant upside)
**Probability of landing in 90 days**: Medium-High

### Role 3: Senior Director / VP Marketing — Regional Restaurant or Retail Group
**Why this fits**: Her food industry adjacent experience, combined with desire for hybrid/flexible work, aligns with regional restaurant groups and specialty retailers headquartered in her target markets.

**Target comp**: $175K-$200K base + 20% bonus
**Probability of landing in 90 days**: Medium

## Competitive Positioning Strategy

**Core narrative**: "I build brands that drive measurable revenue growth — not just awareness. In my current role, I turned a stagnant legacy brand into a $8.2M product launch while cutting media waste by 40%."

**Three proof points to lead with**:
1. $8.2M first-year revenue from new product launch (end-to-end ownership)
2. Brand awareness growth from 34% → 52% in 18 months
3. 3.2x ROAS improvement on $12M media budget

**Positioning against other candidates**: Most VP Marketing candidates at her level either have brand OR performance experience. She has both — and can prove it with numbers. This is her differentiator in every conversation.

## 7-Day Quick-Start Action Plan

**Day 1 (45 minutes)**
- Update LinkedIn headline to: "Marketing Director | Brand Strategy & Revenue Growth | CPG → Open to VP opportunities"
- Add quantified results to current role description (use the three proof points above)

**Day 2 (30 minutes)**
- Send the networking outreach messages below to 5 people in your target industries
- Set up Google Alerts for "VP Marketing" + your target company names

**Day 3 (60 minutes)**
- Create a "Brand Transformation" case study document (1 page) featuring the $8.2M product launch
- This becomes your leave-behind in interviews and your response to "tell me about a time..."

**Day 4 (30 minutes)**
- Identify 3 executive recruiters who specialize in marketing leadership roles in your target industries
- Send recruiter outreach message (template below)

**Day 5 (45 minutes)**
- Research 10 target companies, identify the CMO or CEO at each
- Draft personalized connection requests for LinkedIn

**Day 6 (30 minutes)**
- Follow up on any responses from Day 2 outreach
- Apply to 2-3 roles on LinkedIn using "Easy Apply" with your updated profile

**Day 7 (20 minutes)**
- Review the week's activity, note any responses or leads
- Plan next week's outreach targets

## Copy-Paste Outreach Messages

### Message 1: Warm Network Reactivation
"Hi [first name] — I've been heads-down at [current company] for the past few years and am starting to explore what's next. I'm looking at VP Marketing roles in DTC/consumer brands, ideally where I can bring my brand-building and team leadership experience. Would you have 15 minutes for a quick call this week? I'd value your perspective on the market."

### Message 2: Cold Outreach to Target Company Leader
"Hi [first name] — I've been following [company name]'s growth and I'm impressed by [specific thing]. I lead brand marketing at a Fortune 500 CPG company where I recently drove an $8.2M product launch and grew brand awareness 53% in 18 months. I'm exploring VP-level marketing opportunities and would love to learn more about your team's direction. Open to a brief conversation?"

### Message 3: Recruiter Introduction
"Hi [first name] — I'm a marketing director at a Fortune 500 CPG company exploring VP Marketing opportunities. Quick highlights: $12M media budget ownership, $8.2M product launch, team of 4. I'm targeting DTC brands, growth-stage tech, or consumer companies in the $100M-$500M range. Currently at $174K total comp, targeting $200K+ base. Happy to send my resume if this aligns with any active searches."`,
    intake_json: {
      'Full name': 'Sarah Mitchell',
      'Email address': 'sarah.mitchell@gmail.com',
      'Current title': 'Director of Brand Marketing',
      'Company / industry': 'Fortune 500 CPG Company',
      'How long in your current role?': '6 years',
      'Current comp (rough range is fine)': '$145K base + 20% bonus',
      "What's driving you to leave?": 'Underleveled for my scope. Managing $12M budget and team of 4 but stuck at Director title. No path to VP internally.',
      'What do you want next?': 'VP Marketing at a company where I can own the brand strategy end-to-end. Ideally DTC or growth-stage.',
      'Target comp': '$200K+ base',
      'List 5–8 accomplishments (bullets; numbers if possible)': '- Grew brand awareness from 34% to 52% in 18 months\n- Led product launch generating $8.2M first-year revenue\n- Improved ROAS from 1.8x to 3.2x on $12M media budget\n- Built and restructured team of 4, reducing agency spend by 40%\n- Managed cross-functional launch across R&D, sales, supply chain',
    },
  },
  {
    id: '2',
    client_name: 'James Chen',
    client_email: 'jchen.careers@outlook.com',
    tier: '79' as const,
    status: 'sent' as AuditStatus,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    audit_content: null,
    intake_json: {},
  },
  {
    id: '3',
    client_name: 'Priya Sharma',
    client_email: 'priya.s@gmail.com',
    tier: '149' as const,
    status: 'processing' as AuditStatus,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    audit_content: null,
    intake_json: {},
  },
  {
    id: '4',
    client_name: 'Marcus Johnson',
    client_email: 'marcus.j.johnson@yahoo.com',
    tier: '79' as const,
    status: 'error' as AuditStatus,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    audit_content: null,
    intake_json: {},
  },
  {
    id: '5',
    client_name: 'Elena Vasquez',
    client_email: 'elena.v@protonmail.com',
    tier: '149' as const,
    status: 'sent' as AuditStatus,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    audit_content: null,
    intake_json: {},
  },
];

function Badge({ status }: { status: AuditStatus }) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function ListView({ onSelect }: { onSelect: (id: string) => void }) {
  const stats = {
    total: mockAudits.length,
    pending: mockAudits.filter((a) => a.status === 'pending_review').length,
    sentToday: mockAudits.filter((a) => a.status === 'sent').length,
  };

  return (
    <div>
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

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Client</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mockAudits.map((audit) => (
              <tr
                key={audit.id}
                onClick={() => onSelect(audit.id)}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-gray-900">{audit.client_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{audit.client_email}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    ${audit.tier}
                  </span>
                </td>
                <td className="px-4 py-3"><Badge status={audit.status} /></td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(audit.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailView({ auditId, onBack }: { auditId: string; onBack: () => void }) {
  const audit = mockAudits.find((a) => a.id === auditId)!;
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            &larr; Back
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{audit.client_name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-gray-500">${audit.tier} tier</span>
              <Badge status={audit.status} />
            </div>
          </div>
        </div>
        <div>
          {audit.status === 'pending_review' && (
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Approve + Send
            </button>
          )}
          {audit.status === 'sent' && (
            <button disabled className="rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-800 cursor-not-allowed">
              Sent
            </button>
          )}
          {audit.status === 'processing' && (
            <button disabled className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500 cursor-not-allowed">
              Generating...
            </button>
          )}
          {audit.status === 'error' && (
            <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              Retry Generation
            </button>
          )}
        </div>
      </div>

      {audit.status === 'error' && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Generation Error</p>
          <p className="mt-1 text-sm text-red-600">Claude API rate limit exceeded. Retry in a few minutes.</p>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Intake Responses
          </h2>
          {Object.keys(audit.intake_json).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(audit.intake_json).map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{key}</p>
                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Intake data shown here</p>
          )}
        </div>

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
          ) : audit.audit_content ? (
            <textarea
              defaultValue={audit.audit_content}
              className="h-[calc(100vh-280px)] w-full resize-none rounded-lg border border-gray-200 p-4 font-mono text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <p className="py-20 text-center text-sm text-gray-400">Audit content appears here after generation.</p>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Confirm Send</h3>
            <p className="mt-2 text-sm text-gray-600">
              Send to <strong>{audit.client_email}</strong>? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Yes, Send It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreviewPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Career Clarity Audits</h1>
            <p className="text-sm text-gray-500">NxtGen Heights</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">Preview Mode</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        {selectedId ? (
          <DetailView auditId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <ListView onSelect={setSelectedId} />
        )}
      </main>
    </div>
  );
}
