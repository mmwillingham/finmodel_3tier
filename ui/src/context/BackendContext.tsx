import { createContext, useState, useEffect, useContext, type ReactNode } from 'react';

interface BackendContextValue {
  isReady: boolean;
  isWaking: boolean;
}

const BackendContext = createContext<BackendContextValue>({ isReady: false, isWaking: false });

interface BackendProviderProps {
  children: ReactNode;
}

const HEALTH_CHECK_INTERVAL_MS = 2000;

export const BackendProvider = ({ children }: BackendProviderProps) => {
  const [isReady, setIsReady] = useState(false);
  const [isWaking, setIsWaking] = useState(false);

  const healthUrl = `${process.env.REACT_APP_API_URL}/health`;

  const checkHealth = async () => {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        setIsReady(true);
        setIsWaking(false);
      } else {
        throw new Error('Not ready');
      }
    } catch (err: any) {
      setIsWaking(true);
      setTimeout(checkHealth, HEALTH_CHECK_INTERVAL_MS);
    }
  };

  useEffect(() => {
    checkHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BackendContext.Provider value={{ isReady, isWaking }}>
      {children}
    </BackendContext.Provider>
  );
};

export const useBackend = () => useContext(BackendContext);
