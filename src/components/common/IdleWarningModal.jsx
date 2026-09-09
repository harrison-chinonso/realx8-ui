import { useEffect, useState } from 'react';
import Button from '../ui/Button';

/**
 * Modal shown ~1 minute before auto-logout due to inactivity.
 * Disappears automatically when the user interacts (parent resets the timer).
 */
export default function IdleWarningModal({ visible, secondsLeft, onStayLoggedIn }) {
  const [count, setCount] = useState(secondsLeft);

  useEffect(() => {
    if (!visible) {
      setCount(secondsLeft);
      return;
    }
    setCount(secondsLeft);
    const interval = setInterval(() => {
      setCount((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, secondsLeft]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="text-4xl mb-3">⏱️</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Session Expiring Soon</h2>
        <p className="text-sm text-gray-500 mb-6">
          You'll be logged out in{' '}
          <span className="font-bold text-red-500">{count}s</span> due to inactivity.
        </p>
        <Button onClick={onStayLoggedIn} className="w-full">
          Stay Logged In
        </Button>
      </div>
    </div>
  );
}
