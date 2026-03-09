import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import SettingsService from '../services/settings.service';

type SettingsData = Record<string, unknown>;

interface SettingsContextValue {
  settings: SettingsData | null;
  loading: boolean;
  refreshSettings: () => Promise<SettingsData | undefined>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await SettingsService.getSettings();
      setSettings(response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to load settings', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings().catch((err: any) => console.error('Unable to initialize settings', err));
  }, [loadSettings]);

  const refreshSettings = useCallback(() => {
    return loadSettings();
  }, [loadSettings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
}
