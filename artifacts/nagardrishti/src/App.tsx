import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import Overview from '@/pages/overview';
import Tickets from '@/pages/tickets';
import TicketDetailPage from '@/pages/ticket-detail';
import Reviews from '@/pages/reviews';
import Contractors from '@/pages/contractors';
import Settings from '@/pages/settings';
import PublicTracker from '@/pages/public';
import Report from '@/pages/report';
import Login from '@/pages/login';
import Privacy from '@/pages/privacy';
import { RequireRole } from '@/components/shell';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

function ContractorsGuarded() {
  return <RequireRole roles={['je', 'commissioner']}><Contractors /></RequireRole>;
}

function ReviewsGuarded() {
  return <RequireRole roles={['je', 'commissioner']}><Reviews /></RequireRole>;
}

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Overview} />
          <Route path="/tickets" component={Tickets} />
          <Route path="/tickets/:id" component={TicketDetailPage} />
          <Route path="/reviews" component={ReviewsGuarded} />
          <Route path="/contractors" component={ContractorsGuarded} />
          <Route path="/settings" component={Settings} />
          <Route path="/public" component={PublicTracker} />
          <Route path="/report" component={Report} />
          <Route path="/login" component={Login} />
          <Route path="/privacy" component={Privacy} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Road health overview', '/tickets': 'Road hazard tickets',
      '/reviews': 'Engineer review queue', '/contractors': 'Contractor accountability',
      '/settings': 'Review settings', '/public': 'Public road repair tracker',
      '/report': 'Report a road hazard', '/login': 'Sign in', '/privacy': 'Privacy notice',
    };
    const title = titles[location] ?? (location.startsWith('/tickets/') ? 'Ticket details' : 'Page not found');
    document.title = `${title} · NagarDrishti`;
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
  }, [location]);
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
