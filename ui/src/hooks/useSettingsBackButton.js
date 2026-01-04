import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook to fix browser back button navigation from settings pages.
 * Ensures that when clicking back from a settings page, user goes to home instead of login.
 */
export const useSettingsBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const handlerRef = useRef(null);

  useEffect(() => {
    // Only set up if we're on a settings page
    if (location.pathname.startsWith('/settings')) {
      // Intercept popstate events (browser back/forward buttons)
      const handlePopState = (event) => {
        // Small delay to let React Router process the navigation
        setTimeout(() => {
          const currentPath = window.location.pathname;
          // If back button would take us to login or signup, redirect to home
          if (currentPath === '/login' || currentPath === '/signup') {
            navigate('/', { replace: true });
          }
        }, 10);
      };

      window.addEventListener('popstate', handlePopState);
      handlerRef.current = handlePopState;

      return () => {
        if (handlerRef.current) {
          window.removeEventListener('popstate', handlerRef.current);
          handlerRef.current = null;
        }
      };
    }
  }, [location.pathname, navigate]);
};

