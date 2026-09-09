import { useAppearance } from '../../context/useAppearance';
import ClassicLayout from './ClassicLayout';
import ModernLayout from './ModernLayout';
import MinimalLayout from './MinimalLayout';
import BoldLayout from './BoldLayout';
import GroupedLayout from './GroupedLayout';
import AssistantWidget from '../common/AssistantWidget';

const TEMPLATES = {
  classic: ClassicLayout,
  modern:  ModernLayout,
  minimal: MinimalLayout,
  bold:    BoldLayout,
  grouped: GroupedLayout,
};

export default function AppLayout({ children }) {
  const { template } = useAppearance();
  const Layout = TEMPLATES[template] || ClassicLayout;
  return (
    <>
      <Layout>{children}</Layout>
      <AssistantWidget />
    </>
  );
}

