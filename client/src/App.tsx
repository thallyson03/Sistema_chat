import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthProvider';
import type { UserRole } from './types/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import { AuthBootSkeleton, PageLoadingFallback } from './components/ui/PageSkeleton';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Conversations = lazy(() => import('./pages/Conversations'));
const ConversationDetail = lazy(() => import('./pages/ConversationDetail'));
const Tickets = lazy(() => import('./pages/Tickets'));
const Channels = lazy(() => import('./pages/Channels'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Bots = lazy(() => import('./pages/Bots'));
const BotFlowBuilder = lazy(() => import('./pages/BotFlowBuilder'));
const BotFlowBuilderVisual = lazy(() => import('./pages/BotFlowBuilderVisual'));
const QuickReplies = lazy(() => import('./pages/QuickReplies'));
const Sectors = lazy(() => import('./pages/Sectors'));
const Users = lazy(() => import('./pages/Users'));
const Pipelines = lazy(() => import('./pages/Pipelines'));
const DealDetail = lazy(() => import('./pages/DealDetail'));
const ContactImport = lazy(() => import('./pages/ContactImport'));
const Journeys = lazy(() => import('./pages/Journeys'));
const ContactLists = lazy(() => import('./pages/ContactLists'));
const Templates = lazy(() => import('./pages/Templates'));
const Calendario = lazy(() => import('./pages/Calendario'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoadingFallback />}>{children}</Suspense>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <AuthBootSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RoleRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: UserRole[];
}) {
  const { isLoading, isAuthenticated, hasRole } = useAuth();

  if (isLoading) {
    return <PageLoadingFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRole(roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <LazyPage>
                <Dashboard />
              </LazyPage>
            }
          />
          <Route
            path="conversations"
            element={
              <LazyPage>
                <Conversations />
              </LazyPage>
            }
          />
          <Route
            path="conversations/:id"
            element={
              <LazyPage>
                <ConversationDetail />
              </LazyPage>
            }
          />
          <Route
            path="tickets"
            element={
              <LazyPage>
                <Tickets />
              </LazyPage>
            }
          />
          <Route
            path="channels"
            element={
              <LazyPage>
                <Channels />
              </LazyPage>
            }
          />
          <Route
            path="integrations"
            element={
              <LazyPage>
                <Integrations />
              </LazyPage>
            }
          />
          <Route
            path="quick-replies"
            element={
              <LazyPage>
                <QuickReplies />
              </LazyPage>
            }
          />
          <Route
            path="sectors"
            element={
              <RoleRoute roles={['ADMIN', 'SUPERVISOR']}>
                <LazyPage>
                  <Sectors />
                </LazyPage>
              </RoleRoute>
            }
          />
          <Route
            path="users"
            element={
              <RoleRoute roles={['ADMIN', 'SUPERVISOR']}>
                <LazyPage>
                  <Users />
                </LazyPage>
              </RoleRoute>
            }
          />
          <Route
            path="pipelines"
            element={
              <LazyPage>
                <Pipelines />
              </LazyPage>
            }
          />
          <Route
            path="pipelines/deals/:id"
            element={
              <LazyPage>
                <DealDetail />
              </LazyPage>
            }
          />
          <Route
            path="contacts/import"
            element={
              <RoleRoute roles={['ADMIN', 'SUPERVISOR']}>
                <LazyPage>
                  <ContactImport />
                </LazyPage>
              </RoleRoute>
            }
          />
          <Route
            path="contacts/auto-created"
            element={
              <RoleRoute roles={['ADMIN', 'SUPERVISOR']}>
                <LazyPage>
                  <ContactImport />
                </LazyPage>
              </RoleRoute>
            }
          />
          <Route
            path="journeys"
            element={
              <RoleRoute roles={['ADMIN', 'SUPERVISOR']}>
                <LazyPage>
                  <Journeys />
                </LazyPage>
              </RoleRoute>
            }
          />
          <Route
            path="contact-lists"
            element={
              <LazyPage>
                <ContactLists />
              </LazyPage>
            }
          />
          <Route
            path="templates"
            element={
              <LazyPage>
                <Templates />
              </LazyPage>
            }
          />
          <Route
            path="calendario"
            element={
              <LazyPage>
                <Calendario />
              </LazyPage>
            }
          />
          <Route
            path="audit-logs"
            element={
              <RoleRoute roles={['ADMIN']}>
                <LazyPage>
                  <AuditLogs />
                </LazyPage>
              </RoleRoute>
            }
          />
          <Route
            path="bots"
            element={
              <LazyPage>
                <Bots />
              </LazyPage>
            }
          />
          <Route
            path="bots/:botId/flows"
            element={
              <LazyPage>
                <BotFlowBuilder />
              </LazyPage>
            }
          />
          <Route
            path="bots/:botId/flows/visual"
            element={
              <LazyPage>
                <BotFlowBuilderVisual />
              </LazyPage>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
