import React, { createContext, useState, useEffect, useContext } from 'react';

const BackendContext = createContext();

export const BackendProvider = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [isWaking, setIsWaking] = useState(false);

  const checkHealth = async () => {
    try {
      // Points to your FastAPI /health endpoint
      const response = await fetch(`${process.env.REACT_APP_API_URL}/health`);
      if (response.ok) {
        setIsReady(true);
        setIsWaking(false);
      } else {
        throw new Error("Not ready");
      }
    } catch (err) {
      setIsWaking(true);
      // Retry every 2 seconds until the "Engine" is hot
      setTimeout(checkHealth, 2000);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <BackendContext.Provider value={{ isReady, isWaking }}>
      {children}
    </BackendContext.Provider>
  );
};

export const useBackend = () => useContext(BackendContext);
