import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

interface DrawerContextType {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextType>({
  isOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
});

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  // Block drawer from opening during auth transitions
  const authTransitioning = useRef(false);

  // Force close drawer whenever auth state changes
  useEffect(() => {
    authTransitioning.current = true;
    setIsOpen(false);
    // Allow drawer to open again after a short delay
    const timer = setTimeout(() => {
      authTransitioning.current = false;
    }, 500);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  const openDrawer = useCallback(() => {
    if (!authTransitioning.current && isAuthenticated && !isLoading) {
      setIsOpen(true);
    }
  }, [isAuthenticated, isLoading]);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    if (authTransitioning.current || !isAuthenticated || isLoading) {
      setIsOpen(false);
      return;
    }
    setIsOpen((prev) => !prev);
  }, [isAuthenticated, isLoading]);

  return (
    <DrawerContext.Provider
      value={{ isOpen, openDrawer, closeDrawer, toggleDrawer }}
    >
      {children}
    </DrawerContext.Provider>
  );
}

export const useDrawer = () => useContext(DrawerContext);
