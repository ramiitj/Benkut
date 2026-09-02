import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AgentConfig from './pages/Admin/AgentConfig';
import Governance from './pages/Admin/Governance';
import Branding from './pages/Admin/Branding';
import Billing from './pages/Admin/Billing';
import Login from './pages/Admin/Login';
import { ViewMode, AuthState } from './types';
import VoiceAgentShell from './components/VoiceAgentShell';
import LandingPage from './pages/Landing/LandingPage';
import { LanguageProvider } from './contexts/LanguageContext';

// Wrapper to hide Sidebar on full-screen routes
const Layout: React.FC<{ children: React.ReactNode, mode: ViewMode, setMode: (m: ViewMode) => void, auth: AuthState }> = ({ children, mode, setMode, auth }) => {
  const location = useLocation();
  const isVoiceExperience = mode === ViewMode.USER && !location.pathname.startsWith('/admin') && location.pathname !== '/login';
  const isFullScreen = isVoiceExperience || location.pathname.startsWith('/cooking') || location.pathname === '/login' || location.pathname === '/';
  
  return (
    <div className="app-shell">
      {!isFullScreen && <Sidebar mode={mode} setMode={setMode} auth={auth} />}
      <main className={`app-main ${isFullScreen ? 'full-screen' : ''}`}>
        {children}
      </main>
    </div>
  );
};

const ProtectedRoute: React.FC<{ auth: AuthState, children: React.ReactNode }> = ({ auth, children }) => {
  if (!auth.isAuthenticated || auth.user?.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.USER);
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });

  const handleLogin = (email: string, role: 'admin' | 'user') => {
    setAuth({ isAuthenticated: true, user: { email, role } });
    if (role === 'admin') setViewMode(ViewMode.ADMIN);
  };

  return (
    <LanguageProvider>
      <HashRouter>
        <Layout mode={viewMode} setMode={setViewMode} auth={auth}>
          <Routes>
            {/* Landing page & Kitchen Experience Gateway */}
            <Route path="/" element={<LandingPage />} />

            {/* Public / User Experience */}
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/chef" element={<VoiceAgentShell />} />

            {/* Protected Admin Routes */}
            <Route path="/admin" element={<Navigate to="/admin/insights" />} />
            <Route path="/admin/agent" element={<ProtectedRoute auth={auth}><AgentConfig /></ProtectedRoute>} />
            <Route path="/admin/insights" element={<ProtectedRoute auth={auth}><Governance /></ProtectedRoute>} />
            <Route path="/admin/branding" element={<ProtectedRoute auth={auth}><Branding /></ProtectedRoute>} />
            <Route path="/admin/billing" element={<ProtectedRoute auth={auth}><Billing /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </LanguageProvider>
  );
};

export default App;
