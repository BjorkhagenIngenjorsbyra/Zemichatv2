import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';

export type ThemeName = 'dark' | 'light' | 'ocean' | 'sunset' | 'forest' | 'candy';

interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  muted: string;
  mutedForeground: string;
  border: string;
  bubbleSent: string;
  bubbleReceived: string;
}

const THEMES: Record<ThemeName, ThemeColors> = {
  dark: {
    background: '220 50% 7%',
    foreground: '210 40% 98%',
    card: '220 39% 11%',
    cardForeground: '210 40% 98%',
    primary: '258 90% 80%',
    primaryForeground: '220 50% 7%',
    secondary: '142 76% 36%',
    muted: '215 16% 47%',
    mutedForeground: '215 16% 70%',
    border: '215 25% 27%',
    bubbleSent: '258 90% 80%',
    bubbleReceived: '220 30% 18%',
  },
  light: {
    background: '0 0% 98%',
    foreground: '220 20% 15%',
    card: '0 0% 100%',
    cardForeground: '220 20% 15%',
    primary: '258 80% 60%',
    primaryForeground: '0 0% 100%',
    secondary: '142 60% 40%',
    muted: '220 10% 75%',
    mutedForeground: '220 10% 45%',
    border: '220 10% 88%',
    bubbleSent: '258 80% 60%',
    bubbleReceived: '220 10% 92%',
  },
  ocean: {
    background: '200 50% 8%',
    foreground: '200 20% 95%',
    card: '200 40% 12%',
    cardForeground: '200 20% 95%',
    primary: '190 80% 55%',
    primaryForeground: '200 50% 8%',
    secondary: '170 60% 45%',
    muted: '200 15% 45%',
    mutedForeground: '200 15% 68%',
    border: '200 20% 25%',
    bubbleSent: '190 80% 55%',
    bubbleReceived: '200 30% 18%',
  },
  sunset: {
    background: '20 40% 8%',
    foreground: '30 30% 95%',
    card: '20 30% 12%',
    cardForeground: '30 30% 95%',
    primary: '25 90% 60%',
    primaryForeground: '20 40% 8%',
    secondary: '340 70% 55%',
    muted: '20 15% 45%',
    mutedForeground: '20 15% 68%',
    border: '20 20% 25%',
    bubbleSent: '25 90% 60%',
    bubbleReceived: '20 25% 18%',
  },
  forest: {
    background: '150 30% 7%',
    foreground: '140 20% 95%',
    card: '150 25% 11%',
    cardForeground: '140 20% 95%',
    primary: '142 70% 50%',
    primaryForeground: '150 30% 7%',
    secondary: '80 60% 45%',
    muted: '150 10% 45%',
    mutedForeground: '150 10% 68%',
    border: '150 15% 25%',
    bubbleSent: '142 70% 50%',
    bubbleReceived: '150 20% 18%',
  },
  candy: {
    background: '330 30% 95%',
    foreground: '330 20% 15%',
    card: '0 0% 100%',
    cardForeground: '330 20% 15%',
    primary: '330 80% 60%',
    primaryForeground: '0 0% 100%',
    secondary: '280 60% 60%',
    muted: '330 10% 75%',
    mutedForeground: '330 10% 45%',
    border: '330 15% 88%',
    bubbleSent: '330 80% 60%',
    bubbleReceived: '330 15% 90%',
  },
};

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  availableThemes: ThemeName[];
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  availableThemes: Object.keys(THEMES) as ThemeName[],
});

export const useTheme = () => useContext(ThemeContext);

function applyTheme(name: ThemeName) {
  const colors = THEMES[name];
  const root = document.documentElement;

  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--foreground', colors.foreground);
  root.style.setProperty('--card', colors.card);
  root.style.setProperty('--card-foreground', colors.cardForeground);
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-foreground', colors.primaryForeground);
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--muted-foreground', colors.mutedForeground);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--input', colors.border);
  root.style.setProperty('--ring', colors.primary);
  root.style.setProperty('--bubble-sent', colors.bubbleSent);
  root.style.setProperty('--bubble-received', colors.bubbleReceived);
  root.style.setProperty('--popover', colors.card);
  root.style.setProperty('--popover-foreground', colors.cardForeground);
  root.style.setProperty('--accent', colors.secondary);
  root.style.setProperty('--accent-foreground', colors.primaryForeground);

  // Mirror the active theme onto the Ionic-only aliases used by ion-* CSS
  // overrides in theme/variables.css. We can't write
  // `--background: hsl(var(--background))` on Ionic elements (circular
  // ref), so we expose a parallel set of vars and let Ionic read those.
  root.style.setProperty('--ion-app-bg', colors.background);
  root.style.setProperty('--ion-app-fg', colors.foreground);
  root.style.setProperty('--ion-app-border', colors.border);
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    return (localStorage.getItem('zemichat-theme') as ThemeName) || 'dark';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (name: ThemeName) => {
    localStorage.setItem('zemichat-theme', name);
    setThemeState(name);
  };

  // Audit fix #36-5: memo:a context-värdet så provider inte invalida 30+
  // konsumenter varje render.
  const value = useMemo(
    () => ({
      theme,
      setTheme,
      availableThemes: Object.keys(THEMES) as ThemeName[],
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default ThemeContext;
