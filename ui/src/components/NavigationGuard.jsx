import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Global navigation guard that prevents authenticated users from navigating
 * back to login/signup pages via browser back button, and ensures back button
 * from home page doesn't go to settings pages
 */
const NavigationGuard = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const isOnHomePageRef = useRef(location.pathname === '/' || location.pathname === '/app');

  useEffect(() => {
    // If user is authenticated and tries to navigate to login/signup, redirect to home
    if (currentUser && (location.pathname === '/login' || location.pathname === '/signup')) {
      navigate('/app', { replace: true });
    }
    
    // Track if we're on home page
    isOnHomePageRef.current = location.pathname === '/' || location.pathname === '/app';
  }, [location.pathname, currentUser, navigate]);

  useEffect(() => {
    // Intercept browser back/forward button navigation
    const handlePopState = (event) => {
      // Capture the current state synchronously BEFORE React Router processes the navigation
      const wasOnHomePage = isOnHomePageRef.current;
      
      // Use setTimeout to allow React Router to process the navigation first
      setTimeout(() => {
        const currentPath = window.location.pathname;
        
        if (!currentUser) {
          return; // Don't interfere if user is not authenticated
        }

        // If user is authenticated and back button would take them to login/signup, redirect to home
        if (currentPath === '/login' || currentPath === '/signup') {
          navigate('/app', { replace: true });
          return;
        }

        // If we were on home page and back button took us to a settings page, redirect back to home
        // This prevents going back to settings pages when viewing charts on home page
        if (wasOnHomePage && currentPath.startsWith('/settings')) {
          // Cancel this navigation and stay on home
          window.history.pushState(null, '', currentPath); // Temporarily restore the settings path in history
          navigate('/app', { replace: true }); // Then redirect to home, replacing it
          return;
        }
      }, 10);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentUser, navigate]);

  return children;
};

export default NavigationGuard;

