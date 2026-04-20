import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Sidebar from './components/Sidebar'
import LandingPage from './pages/LandingPage'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Schedule = lazy(() => import('./pages/Schedule'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const Analytics = lazy(() => import('./pages/Analytics'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const VideosPage = lazy(() => import('./pages/VideosPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const ActivityPage = lazy(() => import('./pages/ActivityPage'))
const MediaLibraryPage = lazy(() => import('./pages/MediaLibraryPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ReportingDashboard = lazy(() => import('./pages/ReportingDashboard'))

function RouteFallback() {
  return (
    <div className="page-body">
      <div className="flex-center page-loader" style={{ padding: '2rem', display: 'inline-block', margin: 'auto' }}>
        <span className="spinner" />
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { getAuthStatus } from './api'

function MainLayout() {
  const { user, loading: authLoading } = useAuth();
  const [youtubeStatus, setYoutubeStatus] = useState(null);
  const [ytLoading, setYtLoading] = useState(true);
  
  const refreshYtStatus = async () => {
    if (!user) return;
    try {
      const res = await getAuthStatus();
      setYoutubeStatus(res.data);
    } catch {
      setYoutubeStatus({ connected: false });
    } finally {
      setYtLoading(false);
    }
  };

  useEffect(() => {
    if (user) refreshYtStatus();
  }, [user]);

  if (authLoading) return <RouteFallback />;
  if (!user) return <LandingPage />;

  return (
    <div className="app-shell">
      <Sidebar authStatus={youtubeStatus} />
      <div className="main-content">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard authStatus={youtubeStatus} authLoading={ytLoading} onRefresh={refreshYtStatus} />} />
            <Route path="/schedule" element={<Schedule authStatus={youtubeStatus} authLoading={ytLoading} />} />
            <Route path="/calendar" element={<CalendarPage authStatus={youtubeStatus} authLoading={ytLoading} />} />
            <Route path="/videos" element={<VideosPage authStatus={youtubeStatus} authLoading={ytLoading} />} />
            <Route path="/media" element={<MediaLibraryPage authStatus={youtubeStatus} authLoading={ytLoading} />} />
            <Route path="/notifications" element={<NotificationsPage authStatus={youtubeStatus} authLoading={ytLoading} />} />
            <Route path="/templates" element={<TemplatesPage authStatus={youtubeStatus} authLoading={ytLoading} />} />
            <Route path="/activity" element={<ActivityPage authStatus={youtubeStatus} authLoading={ytLoading} />} />
            <Route path="/analytics" element={<Analytics authStatus={youtubeStatus} authLoading={ytLoading} />} />
            <Route path="/reports" element={<ReportingDashboard authStatus={youtubeStatus} />} />
            <Route path="/settings" element={<SettingsPage authStatus={youtubeStatus} authLoading={ytLoading} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              boxShadow: 'var(--shadow-md)',
            },
          }}
        />
        <MainLayout />
      </BrowserRouter>
    </AuthProvider>
  )
}
