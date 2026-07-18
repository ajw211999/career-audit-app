import IntakeForm from '@/app/intake/[token]/IntakeForm';

// Internal visual preview of the buyer intake (no database, no emails).
// Renders the exact production form component in render-only mode.

export default function IntakePreviewPage() {
  return (
    <IntakeForm
      token="00000000-0000-4000-8000-000000000000"
      firstName="Antoine"
      initialAnswers={{}}
      needsInfo={false}
      preview
    />
  );
}
