import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import useAuthStore from '../../store/authStore';
import { accountDeletionCheckApi, deleteAccountApi } from '../../api/authApi';

/**
 * Deleting the account held with the company you are currently signed in to.
 *
 * ── One company, not the person ─────────────────────────────────────────────
 *
 * Somebody who deals with three companies here has three accounts sharing an
 * email address. This deletes exactly one of them — the one this session is
 * signed in as — and the panel says so in as many words, because "Delete
 * account" read literally promises something much larger than what happens.
 * The others keep working and are not told.
 *
 * ── Why the state comes from the server ─────────────────────────────────────
 *
 * The preflight decides both what stands in the way (unsettled invoices,
 * commissions still owed) and how the deletion must be confirmed. Neither is
 * guessable here, and finding out by submitting and being refused reads as the
 * deletion having half-happened. So the dialog asks first and says what it
 * learned before anything is typed.
 */
export default function DeleteAccountPanel() {
  const logout = useAuthStore((state) => state.logout);

  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState(null);
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCheck(await accountDeletionCheckApi());
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not check this account. Please try again.');
      setCheck(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) runCheck(); }, [open, runCheck]);

  const openDialog = () => { setSecret(''); setError(''); setDone(false); setOpen(true); };
  const closeDialog = () => { if (!busy) { setOpen(false); setSecret(''); setError(''); } };

  // Google accounts never chose a password, so those confirm with a phrase.
  const byPassword = check?.method !== 'confirmation';
  const ready = byPassword ? secret.length > 0 : secret.trim().toUpperCase() === 'DELETE';

  const confirm = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteAccountApi(byPassword ? { password: secret } : { confirmation: secret });
      setDone(true);
      /*
       * Signed out rather than left on a page belonging to a company this
       * account no longer has. The pause is so the confirmation is actually
       * read — every request from here on would 401 anyway.
       */
      setTimeout(() => { logout(); window.location.assign('/login'); }, 1800);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete this account. Please try again.');
      setBusy(false);
    }
  };

  const companyName = check?.company?.name;
  const others = check?.other_company_accounts || 0;

  return (
    <>
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-rose-900">Delete this account</h3>
            <p className="mt-1 text-sm text-rose-800/80">
              Closes the account you hold with this company and signs you out. Your records stay
              with the company for its own history, and you will no longer be able to sign in here.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={openDialog}
              className="mt-3 border-rose-300 !text-rose-700 hover:!bg-rose-100"
            >
              <Trash2 className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
              Delete account
            </Button>
          </div>
        </div>
      </div>

      <Modal open={open} onClose={closeDialog} title="Delete account" size="sm">
        {done ? (
          <div className="space-y-2 py-2 text-center">
            <p className="text-sm font-medium text-slate-900">Your account has been deleted.</p>
            <p className="text-sm text-slate-500">Signing you out…</p>
          </div>
        ) : loading ? (
          <p className="py-6 text-center text-sm text-slate-500">Checking this account…</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              This deletes your account with
              {' '}
              <span className="font-semibold">{companyName || 'this company'}</span>
              {' '}
              and signs you out. It cannot be undone.
            </p>

            {/* The reassurance that makes the scope believable. */}
            {others > 0 && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
                Your {others === 1 ? 'account' : `${others} accounts`} with other companies
                {' '}
                {others === 1 ? 'is' : 'are'} not affected and will keep working.
              </p>
            )}

            {check?.blockers?.length > 0 ? (
              <div className="space-y-2">
                {check.blockers.map((blocker) => (
                  <p
                    key={blocker.code}
                    className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200"
                  >
                    {blocker.message}
                  </p>
                ))}
                <div className="flex justify-end pt-1">
                  <Button type="button" variant="secondary" onClick={closeDialog}>Close</Button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="delete-confirm" className="mb-1 block text-sm font-medium text-slate-700">
                    {byPassword ? 'Enter your password to confirm' : 'Type DELETE to confirm'}
                  </label>
                  <Input
                    id="delete-confirm"
                    type={byPassword ? 'password' : 'text'}
                    value={secret}
                    onChange={(e) => { setSecret(e.target.value); setError(''); }}
                    placeholder={byPassword ? '••••••••' : 'DELETE'}
                    autoComplete={byPassword ? 'current-password' : 'off'}
                  />
                  {!byPassword && (
                    <p className="mt-1 text-xs text-slate-500">
                      This account signs in with Google, so there is no password to enter.
                    </p>
                  )}
                </div>

                {error && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="secondary" onClick={closeDialog} disabled={busy}>Cancel</Button>
                  <Button
                    type="button"
                    onClick={confirm}
                    disabled={!ready || busy}
                    className="!bg-rose-600 hover:!bg-rose-700"
                  >
                    {busy ? 'Deleting…' : 'Delete my account'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
