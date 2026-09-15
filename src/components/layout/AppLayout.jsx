import { useAppearance } from '../../context/useAppearance';
import ClassicLayout from './ClassicLayout';
import ModernLayout from './ModernLayout';
import MinimalLayout from './MinimalLayout';
import BoldLayout from './BoldLayout';
import GroupedLayout from './GroupedLayout';
import LauncherLayout from './LauncherLayout';
import AssistantWidget from '../common/AssistantWidget';
import { NavBadges } from './NavBadge';

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
  const Layout = TEMPLATES[template] || ClassicLayout;
  return (
    <>
      {/*
        Mounted here, above the layout templates, so the counts are fetched once
        per session rather than once per template — and so switching template in
        Appearance settings cannot change whether badges work.
      */}
      <NavBadges />
      <Layout>{children}</Layout>
      <AssistantWidget />
    </>
  );
}

