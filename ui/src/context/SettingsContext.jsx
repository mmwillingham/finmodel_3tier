import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import SettingsService from "../services/settings.service";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await SettingsService.getSettings();
      setSettings(response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to load settings from context:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings().catch(() => {});
  }, [loadSettings]);

  const refreshSettings = useCallback(async () => {
    return loadSettings();
  }, [loadSettings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettingsContext must be used within a SettingsProvider");
  }
  return context;
}
