import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import ConversationDetail from './pages/ConversationDetail';
import Channels from './pages/Channels';
import Integrations from './pages/Integrations';
import Bots from './pages/Bots';
import BotFlowBuilder from './pages/BotFlowBuilder';
import BotFlowBuilderVisual from './pages/BotFlowBuilderVisual';
import QuickReplies from './pages/QuickReplies';
import Sectors from './pages/Sectors';
import Users from './pages/Users';
import Pipelines from './pages/Pipelines';
import DealDetail from './pages/DealDetail';
import ContactImport from './pages/ContactImport';
import Journeys from './pages/Journeys';
import ContactLists from './pages/ContactLists';
import Templates from './pages/Templates';
import Calendario from './pages/Calendario';
import AuditLogs from './pages/AuditLogs';
import Layout from './components/Layout';
import TicketsRedirect from './pages/TicketsRedirect';
import api from './utils/api';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        await api.get('/api/auth/me');
        if (!cancelled) setIsAuthenticated(true);
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
        }
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isAuthenticated === null) {
    return <div>Carregando...</div>;
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
  roles: Array<'ADMIN' | 'SUPERVISOR' | 'AGENT'>;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/auth/me')
      .then((res) => {
        if (!cancelled) {
          setAllowed(roles.includes(res.data?.role));
        }
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roles]);

  if (allowed === null) return <div>Carregando...</div>;
  if (!allowed) return <Navigate to="/dashboard" replace />;
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
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="conversations/:id" element={<ConversationDetail />} />
          <Route path="tickets" element={<TicketsRedirect />} />
          <Route path="channels" element={<Channels />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="quick-replies" element={<QuickReplies />} />
          <Route
            path="sectors"
            element={
              <RoleRoute roles={['ADMIN', 'SUPERVISOR']}>
                <Sectors />
              </RoleRoute>
            }
          />
          <Route
            path="users"
            element={
              <RoleRoute roles={['ADMIN', 'SUPERVISOR']}>
                <Users />
              </RoleRoute>
            }
          />
          <Route path="pipelines" element={<Pipelines />} />
          <Route path="pipelines/deals/:id" element={<DealDetail />} />
          <Route
            path="contacts/import"
            element={
              <RoleRoute roles={['ADMIN', 'SUPERVISOR']}>
                <ContactImport />
              </RoleRoute>
            }
          />
          <Route
            path="contacts/auto-created"
            element={
              <RoleRoute roles={['ADMIN', 'SUPERVISOR']}>
                <ContactImport />
              </RoleRoute>
            }
          />
          <Route
            path="journeys"
            element={
              <RoleRoute roles={['ADMIN', 'SUPERVISOR']}>
                <Journeys />
              </RoleRoute>
            }
          />
          <Route path="contact-lists" element={<ContactLists />} />
          <Route path="templates" element={<Templates />} />
          <Route path="calendario" element={<Calendario />} />
          <Route
            path="audit-logs"
            element={
              <RoleRoute roles={['ADMIN']}>
                <AuditLogs />
              </RoleRoute>
            }
          />
          <Route path="bots" element={<Bots />} />
          <Route path="bots/:botId/flows" element={<BotFlowBuilder />} />
          <Route path="bots/:botId/flows/visual" element={<BotFlowBuilderVisual />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
