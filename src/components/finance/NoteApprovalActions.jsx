import { useState } from 'react';
import { approveNote, rejectNote, settleNote } from '../../api/financeApi';
import { usePermission } from '../../hooks/usePermission';
import Button from '../ui/Button';
import Modal from '../common/Modal';
import FieldMark from '../ui/FieldMark';
import { safeHref } from '../../utils/safeHref';

/**
 * The approve / refuse / settle buttons on a credit or debit note.
 *
 * Shared by both pages because the workflow is identical — only the words
 * differ, since a credit note is used against what somebody owes and a debit
 * note is paid out to them.
 *
 * Approve and Refuse appear only for somebody holding the approval permission,
 * and only on a note that is still waiting. Everyone else sees the status and
 * nothing to press, which is the honest rendering: they cannot do it.
 */

const WORDS = {
  credit: { settle: 'Mark as used', settled: 'used against what they owe' },
  debit: { settle: 'Mark as paid', settled: 'paid out' },
};

/**
 * What settling a FEE note means, which is not what settling an ordinary one
 * means.
 *
 * An ordinary credit note is written off against what somebody owes, and "Mark
 * as used" says that. A verification or upgrade fee is a bill the realtor has
 * paid into the company's account, and pressing this both confirms the money
 * and approves the request it was for. Calling that "Mark as used" would have
 * an approver do the most consequential thing on the screen without the button
 * telling them what it does.
 */
const FEE_SOURCES = ['realtor_verification', 'realtor_levelup'];
const isFeeNote = (note) => FEE_SOURCES.includes(note?.source_type);

export default function NoteApprovalActions({ kind, note, onChanged }) {
  const canApprove = usePermission('finance.notes.approve');
  const canSettle = usePermission(`finance.${kind}-notes.manage`);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const words = WORDS[kind] || WORDS.debit;

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
      await onChanged?.();
    } catch (error) {
      alert(error?.response?.data?.message || 'That did not go through. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitRejection = async (event) => {
    event.preventDefault();
    if (!reason.trim()) return;
    await run(() => rejectNote(kind, note.id, reason.trim()));
    setRejecting(false);
    setReason('');
  };

  return (
    <>
      {note.status === 'pending_approval' && canApprove && (
        <>
          <Button size="sm" disabled={busy} onClick={() => run(() => approveNote(kind, note.id))}>
            Approve
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setRejecting(true)}>
            Refuse
          </Button>
        </>
      )}

      {note.status === 'approved' && canSettle && (
        <>
          {/*
            The evidence, next to the button that acts on it. An approver asked
            to confirm a payment with no way to see the proof from here will
            either go and find it somewhere else or — the failure that matters —
            stop looking.
          */}
          {note.payment_proof_url && (
            <a
              href={safeHref(note.payment_proof_url) ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium underline underline-offset-2"
              style={{ color: 'var(--primary)' }}
            >
              View proof
            </a>
          )}
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => settleNote(kind, note.id))}>
            {isFeeNote(note) ? 'Confirm payment' : words.settle}
          </Button>
        </>
      )}

      <Modal open={rejecting} onClose={() => setRejecting(false)} title="Refuse this note">
        <form onSubmit={submitRejection} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Why are you refusing it?<FieldMark /></span>
            <textarea
              rows={4}
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="text-xs text-slate-500">
              The person who raised it is shown this.
            </span>
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={busy || !reason.trim()}>
              {busy ? 'Saving…' : 'Refuse'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
