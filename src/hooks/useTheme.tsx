import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: ResolvedTheme;
  themePreference: ThemePreference;
  isDark: boolean;
  isSystem: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'dark';
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Modalità automatica di sistema per default
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem('bookshelf_theme_pref');
      if (saved === 'system' || saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // Ignora errori di accesso al localStorage (es. modalità incognito restrittiva)
    }
    return 'system';
  });

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Ascolta i cambiamenti della modalità dark/light del sistema operativo in tempo reale
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    try {
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemChange);
      } else {
        // Fallback per vecchi browser iOS/Safari
        (mediaQuery as any).addListener(handleSystemChange);
      }
    } catch {
      // ignore
    }

    return () => {
      try {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleSystemChange);
        } else {
          (mediaQuery as any).removeListener(handleSystemChange);
        }
      } catch {
        // ignore
      }
    };
  }, []);

  const effectiveTheme: ResolvedTheme =
    themePreference === 'system' ? systemTheme : themePreference;

  const setTheme = (newPref: ThemePreference) => {
    setThemePreferenceState(newPref);
    try {
      localStorage.setItem('bookshelf_theme_pref', newPref);
      localStorage.setItem('bookshelf_theme', newPref === 'system' ? systemTheme : newPref);
    } catch (e) {
      console.warn('Impossibile salvare il tema nel localStorage:', e);
    }
  };

  // Ciclo tra le modalità: Sistema (Auto) -> Chiara -> Scura -> Sistema
  const toggleTheme = () => {
    if (themePreference === 'system') {
      setTheme('light');
    } else if (themePreference === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    }

    // Aggiorna anche i meta tag theme-color e status-bar per la barra del browser / iOS PWA
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', effectiveTheme === 'light' ? '#fcfbfa' : '#1c1917');
    }
    const metaStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (metaStatusBar) {
      metaStatusBar.setAttribute('content', 'default');
    }
    document.body.style.backgroundColor = effectiveTheme === 'light' ? '#fcfbfa' : '#1c1917';
  }, [effectiveTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme: effectiveTheme,
        themePreference,
        isDark: effectiveTheme === 'dark',
        isSystem: themePreference === 'system',
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve essere utilizzato all\'interno di un ThemeProvider');
  }
  return context;
}
