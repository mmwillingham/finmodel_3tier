import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Global navigation guard that prevents authenticated users from navigating
 * back to login/signup pages via browser back button
 */
const NavigationGuard = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  useEffect(() => {
    // If user is authenticated and tries to navigate to login/signup, redirect to home
    if (currentUser && (location.pathname === '/login' || location.pathname === '/signup')) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, currentUser, navigate]);

  useEffect(() => {
    // Intercept browser back/forward button navigation
    const handlePopState = (event) => {
      // Use setTimeout to allow React Router to process the navigation first
      setTimeout(() => {
        const currentPath = window.location.pathname;
        // If user is authenticated and back button would take them to login/signup, redirect to home
        if (currentUser && (currentPath === '/login' || currentPath === '/signup')) {
          navigate('/', { replace: true });
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

