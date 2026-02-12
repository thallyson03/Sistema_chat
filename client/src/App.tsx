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
import Campaigns from './pages/Campaigns';
import Journeys from './pages/Journeys';
import ContactLists from './pages/ContactLists';
import Layout from './components/Layout';

// Componente para proteger rotas
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    return <div>Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="conversations/:id" element={<ConversationDetail />} />
          <Route path="channels" element={<Channels />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="quick-replies" element={<QuickReplies />} />
          <Route path="sectors" element={<Sectors />} />
          <Route path="users" element={<Users />} />
          <Route path="pipelines" element={<Pipelines />} />
          <Route path="pipelines/deals/:id" element={<DealDetail />} />
          <Route path="contacts/import" element={<ContactImport />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="journeys" element={<Journeys />} />
          <Route path="contact-lists" element={<ContactLists />} />
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
