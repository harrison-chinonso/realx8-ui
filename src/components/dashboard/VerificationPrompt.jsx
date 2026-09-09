import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import Button from '../ui/Button';

/**
 * Verification status on the realtor dashboard.
 *
 * The page itself lives under Realtor Hub, which is easy to miss — this puts
 * the prompt where a realtor actually lands. Hidden once approved, so it does
 * not nag people who are already done. The record is passed in, so the
 * dashboard fetches it once and shares it with the Verified badge.
 */
export default function VerificationPrompt({ record, loading }) {
  if (loading) return null;
  if (record?.status === 'approved') return null;

  const pending = record?.status === 'pending';
  const rejected = record?.status === 'rejected';

  const tone = rejected
    ? 'bg-rose-50 ring-rose-200 text-rose-800'
    : pending
      ? 'bg-amber-50 ring-amber-200 text-amber-800'
      : 'bg-sky-50 ring-sky-200 text-sky-800';

  return (
    <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ring-1 ${tone}`}>
      <div className="flex min-w-0 items-center gap-3">
        {rejected ? <ShieldAlert size={20} className="shrink-0" /> : <ShieldCheck size={20} className="shrink-0" />}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {rejected ? 'Your verification needs attention'
              : pending ? 'Verification under review'
              : 'Verify your identity'}
          </p>
          <p className="text-xs opacity-90">
            {rejected ? (record.review_notes || 'Your documents were not accepted. Please resubmit.')
              : pending ? 'We have your documents — an administrator is reviewing them.'
              : 'Upload a means of identification and proof of address to complete your account.'}
          </p>
        </div>
      </div>
      {!pending && (
        <Link to="/realtor/verification">
          <Button type="button" size="sm">{rejected ? 'Update Documents' : 'Start Verification'}</Button>
        </Link>
      )}
    </section>
  );
}
