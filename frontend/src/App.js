import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import TopBar from './components/TopBar';
import LocalitiesDrawer from './components/LocalitiesDrawer';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Lazy load pages for faster initial load
const HomePage = lazy(() => import('./pages/HomePage'));
const BrowsePage = lazy(() => import('./pages/BrowsePage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const MeetingDetailPage = lazy(() => import('./pages/MeetingDetailPage'));

function PageLoader() {
  return (
    <div className="px-4 py-8 flex justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppContent() {
  const [theme, setTheme] = useState(() => localStorage.getItem('gal-theme') || 'light');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [localities, setLocalities] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('gal-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); toast.success('Online — sincronizat'); };
    const handleOffline = () => { setIsOnline(false); toast.warning('Offline — salvat local'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchLocalities = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/localities`);
      const data = await res.json();
      setLocalities(data.localities || []);
    } catch (err) {
      console.error('Failed to fetch localities:', err);
    }
  }, []);

  useEffect(() => { fetchLocalities(); }, [fetchLocalities]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenDrawer={() => setDrawerOpen(true)}
        isOnline={isOnline}
      />

      {!isOnline && (
        <div
          data-testid="offline-status-banner"
          className="sticky top-[56px] z-30 px-4 py-2 text-sm bg-[hsl(var(--gal-offline))]/10 text-[hsl(var(--gal-offline))] border-b border-[hsl(var(--gal-offline))]/20 flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-[hsl(var(--gal-offline))] animate-status-pulse" />
          Offline — salvat local
        </div>
      )}

      <LocalitiesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        localities={localities}
        onSelectLocality={(loc) => {
          setDrawerOpen(false);
          if (loc) {
            navigate(`/browse?locality=${encodeURIComponent(loc)}`);
          } else {
            navigate('/browse');
          }
        }}
        onLocalitiesChanged={fetchLocalities}
      />

      <main className="mx-auto w-full max-w-md md:max-w-2xl">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage backendUrl={BACKEND_URL} onMeetingCreated={fetchLocalities} />} />
            <Route path="/browse" element={<BrowsePage backendUrl={BACKEND_URL} localities={localities} />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/meeting/:id" element={<MeetingDetailPage backendUrl={BACKEND_URL} />} />
          </Routes>
        </Suspense>
      </main>

      <Toaster position="top-center" richColors toastOptions={{ duration: 2000 }} />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
