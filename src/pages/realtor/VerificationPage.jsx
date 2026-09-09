import { Navigate } from 'react-router-dom';

/**
 * Verification now lives as a tab on the profile page, so this route only
 * forwards to it. The route itself has to stay: the "verification rejected"
 * email links here, and those links are already out in people's inboxes.
 */
export default function VerificationPage() {
  return <Navigate to="/profile?tab=verification" replace />;
}
