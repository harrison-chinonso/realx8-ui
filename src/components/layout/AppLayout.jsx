import { useAppearance } from '../../context/useAppearance';
import ClassicLayout from './ClassicLayout';
import ModernLayout from './ModernLayout';
import MinimalLayout from './MinimalLayout';
import BoldLayout from './BoldLayout';
import GroupedLayout from './GroupedLayout';
import LauncherLayout from './LauncherLayout';
import AssistantWidget from '../common/AssistantWidget';
import { NavBadges } from './NavBadge';
import BillingBanner from '../billing/BillingBanner';
import usePinnedPage from '../../hooks/usePinnedPage';

const TEMPLATES = {
  classic: ClassicLayout,
  modern:  ModernLayout,
  minimal: MinimalLayout,
  bold:    BoldLayout,
  grouped: GroupedLayout,
  launcher: LauncherLayout,
};

export default function AppLayout({ children }) {
  const { template } = useAppearance();
  const Layout = TEMPLATES[template] || LauncherLayout;
  // The layouts scroll inside themselves; the page under them stays put.
  usePinnedPage();
  return (
    <>
      {/*
        Mounted here, above the layout templates, so the counts are fetched once
        per session rather than once per template — and so switching template in
        Appearance settings cannot change whether badges work.
      */}
      <NavBadges />
      {/*
        Inside the template's content area rather than above it, so it sits
        where the page starts on all six templates without each of them having
        to know about it. It draws nothing while billing is switched off.
      */}
      <Layout>
        <BillingBanner />
        {children}
      </Layout>
      <AssistantWidget />
    </>
  );
}

