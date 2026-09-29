import { createRoute, useParams } from '@tanstack/react-router';
import { isLocale } from '@/lib/i18n';
import { rootRoute } from './__root';
import { FlixoAgentPage } from '../components/FlixoAgentPage';

export const localizedAgentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$locale/agent',
  component: function LocalizedAgentRoute() {
    const { locale: rawLocale } = useParams({ from: '/$locale/agent' });
    const locale = isLocale(rawLocale) ? rawLocale : 'en';
    return <FlixoAgentPage locale={locale} />;
  },
});
