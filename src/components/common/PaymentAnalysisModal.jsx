import Modal from './Modal';
import PaymentAnalysisPanel from '../finance/PaymentAnalysisPanel';

/**
 * Payment Analysis for a client an admin or upline realtor selected.
 *
 * Only the id is passed through; everything shown is re-fetched from the
 * server, which also decides whether this viewer may see it.
 */
export default function PaymentAnalysisModal({ user, open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={user?.name ? `Payment Analysis — ${user.name}` : 'Payment Analysis'} size="xl">
      {open && user?.id ? <PaymentAnalysisPanel userId={user.id} /> : null}
    </Modal>
  );
}
