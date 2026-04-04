import AuditDetail from '@/components/AuditDetail';

export default function AuditDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Career Clarity Audits</h1>
            <p className="text-sm text-gray-500">NxtGen Heights</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <AuditDetail auditId={params.id} />
      </main>
    </div>
  );
}
