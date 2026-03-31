import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Menu, Sun, Moon, Mic, List, ArrowLeft, Wifi, WifiOff } from 'lucide-react';

export default function TopBar({ theme, onToggleTheme, onOpenDrawer, isOnline }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isDetail = location.pathname.startsWith('/meeting/');

  const getTitle = () => {
    if (isHome) return 'GAL Meetings';
    if (isDetail) return 'Detalii';
    return 'Întâlniri';
  };

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
      <div className="mx-auto w-full max-w-md md:max-w-2xl flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2">
          {isDetail ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-10 w-10 rounded-xl"
              data-testid="topbar-back-button"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenDrawer}
              className="h-10 w-10 rounded-xl"
              data-testid="topbar-open-drawer-button"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-lg font-semibold font-['Space_Grotesk'] truncate">{getTitle()}</h1>
        </div>

        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-[hsl(var(--gal-success))]' : 'bg-[hsl(var(--gal-offline))] animate-status-pulse'}`} />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="h-10 w-10 rounded-xl"
            data-testid="topbar-theme-toggle"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {!isHome && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="h-10 w-10 rounded-xl"
              data-testid="topbar-record-button"
            >
              <Mic className="h-5 w-5" />
            </Button>
          )}

          {isHome && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/browse')}
              className="h-10 w-10 rounded-xl"
              data-testid="topbar-browse-button"
            >
              <List className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
