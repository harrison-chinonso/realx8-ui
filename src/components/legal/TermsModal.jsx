import { useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import TermsDocument from './TermsDocument';

/**
 * The full agreement in a reading pane, opened from the sign-up checkboxes.
 * `section` jumps straight to a part — 'part-a' Terms of Use, 'part-b' the
 * Privacy Policy — the text the box being ticked refers to.
 */
export default function TermsModal({ open, terms, section = null, onClose }) {
  const body = useRef(null);
  useEffect(() => {
    if (!open || !section) return;
    const timer = setTimeout(() => body.current?.querySelector(`#${section}`)?.scrollIntoView({ block: 'start' }), 50);
    return () => clearTimeout(timer);
  }, [open, section]);
  return (
    <Modal open={open} onClose={onClose} title="Terms of Use and Privacy Policy" size="xl">
      <div ref={body}>
        {terms ? <TermsDocument terms={terms} /> : <p className="text-sm text-slate-500">Loading…</p>}
      </div>
    </Modal>
  );
}
