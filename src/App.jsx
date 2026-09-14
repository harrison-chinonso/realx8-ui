import { Navigate, Outlet, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import AppLayout from './components/layout/AppLayout';
import useAuthStore from './store/authStore';
import { AppearanceProvider } from './context/AppearanceContext';
import useIdleTimeout from './hooks/useIdleTimeout';
import IdleWarningModal from './components/common/IdleWarningModal';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import GoogleCallbackPage from './pages/auth/GoogleCallbackPage';
import PublicPropertyPage from './pages/public/PublicPropertyPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import PropertiesPage from './pages/properties/PropertiesPage';
import PropertyDetailPage from './pages/properties/PropertyDetailPage';
import PropertyTypesPage from './pages/properties/PropertyTypesPage';
import CreatePropertyPage from './pages/properties/CreatePropertyPage';
import InspectionsPage from './pages/properties/InspectionsPage';
import ListedPropertiesPage from './pages/listed/ListedPropertiesPage';
import ListedPropertyDetailPage from './pages/listed/ListedPropertyDetailPage';
import InvestmentsPage from './pages/investments/InvestmentsPage';
import MyInvestmentsPage from './pages/investments/MyInvestmentsPage';
import RetentionAlertsPage from './pages/investments/RetentionAlertsPage';
import LeadsPage from './pages/crm/LeadsPage';
import DealsPage from './pages/crm/DealsPage';
import TasksPage from './pages/crm/TasksPage';
import PipelinesPage from './pages/crm/PipelinesPage';
import SalesAnalyticsPage from './pages/crm/SalesAnalyticsPage';
import AgentPerformancePage from './pages/crm/AgentPerformancePage';
import SourcesLabelsPage from './pages/crm/SourcesLabelsPage';
import InvoicesPage from './pages/finance/InvoicesPage';
import MyPaymentsPage from './pages/finance/MyPaymentsPage';
import MyPropertiesPage from './pages/finance/MyPropertiesPage';
import CreateInvoicePage from './pages/finance/CreateInvoicePage';
import InvoiceDetailPage from './pages/finance/InvoiceDetailPage';
import TaxesPage from './pages/finance/TaxesPage';
import BankAccountsPage from './pages/finance/BankAccountsPage';
import CreditNotesPage from './pages/finance/CreditNotesPage';
import DebitNotesPage from './pages/finance/DebitNotesPage';
import PaymentRemindersPage from './pages/finance/PaymentRemindersPage';
import ReportsPage from './pages/finance/ReportsPage';
import TransactionsPage from './pages/finance/TransactionsPage';
import PaymentPlansPage from './pages/finance/PaymentPlansPage';
import InstallmentPlansPage from './pages/finance/InstallmentPlansPage';
import NotificationSettingsPage from './pages/settings/NotificationSettingsPage';
import ReceiptsPage from './pages/finance/ReceiptsPage';
import SupportPage from './pages/support/SupportPage';
import UsersPage from './pages/users/UsersPage';
import EmployeesPage from './pages/users/EmployeesPage';
import ClientsPage from './pages/users/ClientsPage';
import RealtorsPage from './pages/users/RealtorsPage';
import RolesPage from './pages/roles/RolesPage';
import CommissionPlansPage from './pages/finance/CommissionPlansPage';
import AuditLogPage from './pages/audit/AuditLogPage';
import CommissionsPage from './pages/commissions/CommissionsPage';
import MyCommissionsPage from './pages/realtor/MyCommissionsPage';
import ReferralPage from './pages/referral/ReferralPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import ProfilePage from './pages/profile/ProfilePage';
import SettingsPage from './pages/settings/SettingsPage';
import MediaPostsPage from './pages/media/MediaPostsPage';
import BlogPage from './pages/media/BlogPage';
import MediaAnalyticsPage from './pages/media/MediaAnalyticsPage';
import SocialAccountsPage from './pages/media/SocialAccountsPage';
import TrainingPage from './pages/realtor/TrainingPage';
import LeaderboardPage from './pages/realtor/LeaderboardPage';
import RecruitmentPage from './pages/realtor/RecruitmentPage';
import RealtorLevelsPage from './pages/realtor/RealtorLevelsPage';
import MyReferralsPage from './pages/realtor/MyReferralsPage';
import MyClientsPage from './pages/realtor/MyClientsPage';
import VerificationPage from './pages/realtor/VerificationPage';
import RealtorVerificationsPage from './pages/users/RealtorVerificationsPage';
import FrontDeskPage from './pages/frontdesk/FrontDeskPage';
import CustomerCarePage from './pages/care/CustomerCarePage';
// Superior admin pages
import PlatformDashboardPage from './pages/superior/PlatformDashboardPage';
import GlobalSettingsPage from './pages/superior/GlobalSettingsPage';
import CompanySettingsPage from './pages/superior/CompanySettingsPage';
import CompaniesPage from './pages/superior/CompaniesPage';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_MS = 60 * 1000;           // warn 1 minute before logout
const WARNING_SECONDS = WARNING_MS / 1000;

function useIdleLogout(enabled) {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);

  useIdleTimeout({
    enabled,
    idleMs: IDLE_TIMEOUT_MS,
    warningMs: WARNING_MS,
    onWarning: () => setShowWarning(true),
    onActivity: () => setShowWarning(false),
    onIdle: () => {
      setShowWarning(false);
      logout();
      navigate('/login', { replace: true });
    },
  });

  return { showWarning, dismissWarning: () => setShowWarning(false) };
}

function ProtectedShell() {
  const token = useAuthStore((state) => state.accessToken);
  const { showWarning, dismissWarning } = useIdleLogout(!!token);

  if (!token) return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      <Outlet />
      <IdleWarningModal
        visible={showWarning}
        secondsLeft={WARNING_SECONDS}
        onStayLoggedIn={dismissWarning}
      />
    </AppLayout>
  );
}

/** Only accessible by superior_admin — redirects everyone else to dashboard */
function SuperiorAdminShell() {
  const token = useAuthStore((s) => s.accessToken);
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const { showWarning, dismissWarning } = useIdleLogout(!!token);

  if (!token) return <Navigate to="/login" replace />;
  if (!isSuperiorAdmin) return <Navigate to="/" replace />;
  return (
    <AppLayout>
      <Outlet />
      <IdleWarningModal
        visible={showWarning}
        secondsLeft={WARNING_SECONDS}
        onStayLoggedIn={dismissWarning}
      />
    </AppLayout>
  );
}

// A referral link carries one of these. Their presence is an explicit request
// to create a NEW account, so it outranks any session already in the browser.
// `ref` is the sealed share token; the other three are the plain-code links
// still in circulation. All of them mean "this person was invited", so the
// sign-up form must win over the redirect below even when a session exists.
const INVITE_PARAMS = ['ref', 'company_code', 'code', 'realtor_code'];

function PublicOnly({ children, allowInvited = false }) {
  const token = useAuthStore((state) => state.accessToken);
  const [params] = useSearchParams();
  if (!token) return children;

  // Without this, a realtor or company link opened in a browser that still has
  // any session — the sharer testing their own link, a shared device, a stale
  // token — silently lands on the dashboard instead of the sign-up form, which
  // reads as "the link goes to the landing page".
  if (allowInvited && INVITE_PARAMS.some((key) => params.get(key))) return children;

  // Honour ?redirect= so signing in mid-flow (e.g. buying from a shared link)
  // returns the user to where they were instead of the dashboard.
  return <Navigate to={params.get('redirect') || '/'} replace />;
}

/**
 * The staff invoice list and the create-invoice form are not for buyers. A
 * client reaches /finance/invoices/:id legitimately after a purchase, and that
 * page's back link used to drop them on the staff list — complete with a
 * "Create invoice" button. They belong on their own invoices page.
 */
function StaffInvoicesRouter({ children }) {
  const effectiveType = useAuthStore((s) => s.effectiveType());
  if (['realtor', 'client'].includes(effectiveType)) return <Navigate to="/finance/my-invoices" replace />;
  return children;
}

/**
 * The staff property catalogue is not for realtors and clients: it exposes
 * Edit/Delete and, critically, has no Purchase button. They get the listed
 * catalogue instead, which is read-only and is where buying happens. Hiding the
 * nav item is not enough — clients hold properties.view, so the route would
 * still render for a typed URL or an old bookmark.
 */
function StaffPropertiesRouter({ children, listedPath }) {
  const effectiveType = useAuthStore((s) => s.effectiveType());
  if (['realtor', 'client'].includes(effectiveType)) return <Navigate to={listedPath} replace />;
  return children;
}

/** Same redirect for a single property, keeping the id so the link still lands. */
function StaffPropertyDetailRouter({ children }) {
  const { id } = useParams();
  const effectiveType = useAuthStore((s) => s.effectiveType());
  if (['realtor', 'client'].includes(effectiveType)) return <Navigate to={`/properties/listed/${id}`} replace />;
  return children;
}

/**
 * Company settings are staff-only. Realtors and clients are sent to their
 * profile instead — the nav item is hidden for them, but the route would
 * otherwise still render for anyone typing the URL.
 */
function SettingsRouter() {
  const effectiveType = useAuthStore((s) => s.effectiveType());
  if (['realtor', 'client'].includes(effectiveType)) return <Navigate to="/profile" replace />;
  return <SettingsPage />;
}

export default function App() {
  return (
    <AppearanceProvider>
      <Routes>
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly allowInvited><RegisterPage /></PublicOnly>} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />

        {/* Shareable property view — no auth, works signed in or out */}
        <Route path="/p/:token" element={<PublicPropertyPage />} />

        {/* Superior admin routes */}
        <Route element={<SuperiorAdminShell />}>
          <Route path="/superior/dashboard" element={<PlatformDashboardPage />} />
          <Route path="/superior/companies" element={<CompaniesPage />} />
          <Route path="/superior/companies/new" element={<CompaniesPage />} />
          <Route path="/superior/companies/:id/settings" element={<CompanySettingsPage />} />
          <Route path="/superior/users" element={<UsersPage />} />
          <Route path="/superior/settings" element={<GlobalSettingsPage />} />
        </Route>

        {/* Regular protected routes */}
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<DashboardPage />} />

          <Route path="/properties" element={<StaffPropertiesRouter listedPath="/properties/listed"><PropertiesPage /></StaffPropertiesRouter>} />
          <Route path="/properties/create" element={<CreatePropertyPage />} />
          <Route path="/properties/inspections" element={<InspectionsPage />} />
          <Route path="/properties/types" element={<PropertyTypesPage />} />
          <Route path="/finance/my-invoices" element={<MyPaymentsPage section="invoices" />} />
          <Route path="/finance/my-properties" element={<MyPropertiesPage />} />
          <Route path="/finance/my-payments" element={<MyPaymentsPage section="payments" />} />
          <Route path="/properties/listed" element={<ListedPropertiesPage />} />
          <Route path="/properties/listed/:id" element={<ListedPropertyDetailPage />} />
          <Route path="/properties/:id" element={<StaffPropertyDetailRouter><PropertyDetailPage /></StaffPropertyDetailRouter>} />

          <Route path="/investments" element={<InvestmentsPage />} />
          <Route path="/investments/portfolio" element={<MyInvestmentsPage />} />
          <Route path="/investments/retention-alerts" element={<RetentionAlertsPage />} />

          <Route path="/crm/leads" element={<LeadsPage />} />
          <Route path="/crm/deals" element={<DealsPage />} />
          <Route path="/crm/tasks" element={<TasksPage />} />
          <Route path="/crm/pipelines" element={<PipelinesPage />} />
          <Route path="/crm/analytics" element={<SalesAnalyticsPage />} />
          <Route path="/crm/agent-performance" element={<AgentPerformancePage />} />
          <Route path="/crm/sources-labels" element={<SourcesLabelsPage />} />

          <Route path="/finance/invoices" element={<StaffInvoicesRouter><InvoicesPage /></StaffInvoicesRouter>} />
          {/* Static segment, so it is matched ahead of /finance/invoices/:id. */}
          <Route path="/finance/invoices/due" element={<StaffInvoicesRouter><InvoicesPage status="due" /></StaffInvoicesRouter>} />
          <Route path="/finance/invoices/create" element={<StaffInvoicesRouter><CreateInvoicePage /></StaffInvoicesRouter>} />
          <Route path="/finance/invoices/:id" element={<InvoiceDetailPage />} />
          {/* The property purchase journey's plan templates — distinct from
              /finance/payment-plans, which is the subscription price list. */}
          <Route path="/finance/installment-plans" element={<InstallmentPlansPage />} />
          <Route path="/finance/commission-plans" element={<CommissionPlansPage />} />
          <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
          <Route path="/finance/taxes" element={<TaxesPage />} />
          <Route path="/finance/bank-accounts" element={<BankAccountsPage />} />
          <Route path="/finance/credit-notes" element={<CreditNotesPage />} />
          <Route path="/finance/debit-notes" element={<DebitNotesPage />} />
          <Route path="/finance/payment-reminders" element={<PaymentRemindersPage />} />
          <Route path="/finance/reports" element={<ReportsPage />} />
          <Route path="/finance/transactions" element={<TransactionsPage />} />
          {/*
            /finance/transactions/pending is gone. It rendered the same page
            pre-filtered to a status no transaction is ever written with, so it
            was a permanently empty screen. Redirected rather than deleted —
            it has been in the menu, so it is in browser histories and
            bookmarks, and a 404 there would read as a broken deploy.
          */}
          <Route path="/finance/transactions/pending" element={<Navigate to="/receipts" replace />} />
          <Route path="/finance/payment-plans" element={<PaymentPlansPage />} />

          <Route path="/media/posts" element={<MediaPostsPage />} />
          <Route path="/media/blog" element={<BlogPage />} />
          <Route path="/media/analytics" element={<MediaAnalyticsPage />} />
          <Route path="/media/social-accounts" element={<SocialAccountsPage />} />

          <Route path="/support" element={<SupportPage />} />
          <Route path="/care" element={<CustomerCarePage section="vip" />} />
          <Route path="/care/communications" element={<CustomerCarePage section="communications" />} />
          <Route path="/care/alerts" element={<CustomerCarePage section="alerts" />} />
          <Route path="/front-desk" element={<FrontDeskPage />} />

          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/employees" element={<EmployeesPage />} />
          <Route path="/users/clients" element={<ClientsPage />} />
          <Route path="/users/realtors" element={<RealtorsPage />} />

          <Route path="/roles" element={<RolesPage />} />
          {/*
            Inside the authenticated layout like any other screen. The route is
            not gated here because the API is: a caller without `audit.view`
            gets a 403 and an empty table, which is the same answer a hidden
            route would give and one answer rather than two that could disagree.
          */}
          <Route path="/audit-logs" element={<AuditLogPage />} />
          <Route path="/commissions" element={<CommissionsPage />} />
          {/* The earner's own view. A realtor has no access to the
              company-wide commissions page. */}
          <Route path="/commissions/mine" element={<MyCommissionsPage />} />
          <Route path="/receipts" element={<ReceiptsPage />} />
          <Route path="/referral" element={<ReferralPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          <Route path="/realtor/training" element={<TrainingPage />} />
          <Route path="/realtor/leaderboard" element={<LeaderboardPage />} />
          <Route path="/realtor/recruitment" element={<RecruitmentPage />} />
          <Route path="/realtor/levels" element={<RealtorLevelsPage />} />
          <Route path="/realtor/referrals" element={<MyReferralsPage />} />
          <Route path="/realtor/clients" element={<MyClientsPage />} />
          <Route path="/realtor/verification" element={<VerificationPage />} />
          <Route path="/users/verifications" element={<RealtorVerificationsPage />} />

          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsRouter />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppearanceProvider>
  );
}
