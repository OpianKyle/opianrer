import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'ocean' | 'forest' | 'sunset' | 'corporate' | 'pink';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: {
    [key in Theme]: {
      name: string;
      description: string;
      colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        surface: string;
        text: string;
        textSecondary: string;
        border: string;
        gradient: string;
        glassBg: string;
      };
    };
  };
}

const themeConfigs = {
  light: {
    name: 'Light',
    description: 'Clean and bright interface',
    colors: {
      primary: '#0073EA',
      secondary: '#00C875',
      accent: '#FF6B6B',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#1E293B',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      gradient: 'linear-gradient(135deg, #0073EA 0%, #00C875 100%)',
      glassBg: 'rgba(248, 250, 252, 0.9)',
    },
  },
  dark: {
    name: 'Dark',
    description: 'Elegant dark interface',
    colors: {
      primary: '#3B82F6',
      secondary: '#10B981',
      accent: '#F59E0B',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F1F5F9',
      textSecondary: '#94A3B8',
      border: '#334155',
      gradient: 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)',
      glassBg: 'rgba(30, 41, 59, 0.9)',
    },
  },
  ocean: {
    name: 'Ocean',
    description: 'Calming ocean blue theme',
    colors: {
      primary: '#0EA5E9',
      secondary: '#06B6D4',
      accent: '#8B5CF6',
      background: '#F0F9FF',
      surface: '#E0F2FE',
      text: '#0C4A6E',
      textSecondary: '#0369A1',
      border: '#BAE6FD',
      gradient: 'linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%)',
      glassBg: 'rgba(240, 249, 255, 0.9)',
    },
  },
  forest: {
    name: 'Forest',
    description: 'Natural green theme',
    colors: {
      primary: '#059669',
      secondary: '#10B981',
      accent: '#F59E0B',
      background: '#F0FDF4',
      surface: '#DCFCE7',
      text: '#14532D',
      textSecondary: '#166534',
      border: '#BBF7D0',
      gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      glassBg: 'rgba(240, 253, 244, 0.9)',
    },
  },
  sunset: {
    name: 'Sunset',
    description: 'Warm sunset colors',
    colors: {
      primary: '#EA580C',
      secondary: '#F59E0B',
      accent: '#EF4444',
      background: '#FFF7ED',
      surface: '#FED7AA',
      text: '#9A3412',
      textSecondary: '#C2410C',
      border: '#FDBA74',
      gradient: 'linear-gradient(135deg, #EA580C 0%, #F59E0B 100%)',
      glassBg: 'rgba(255, 247, 237, 0.9)',
    },
  },
  corporate: {
    name: 'Corporate',
    description: 'Professional corporate theme',
    colors: {
      primary: '#4F46E5',
      secondary: '#7C3AED',
      accent: '#06B6D4',
      background: '#FAFAFA',
      surface: '#F4F4F5',
      text: '#18181B',
      textSecondary: '#52525B',
      border: '#E4E4E7',
      gradient: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
      glassBg: 'rgba(244, 244, 245, 0.9)',
    },
  },
  pink: {
    name: 'Pink',
    description: 'Playful pink theme',
    colors: {
      primary: '#EC4899',
      secondary: '#F472B6',
      accent: '#8B5CF6',
      background: '#FDF2F8',
      surface: '#FCE7F3',
      text: '#831843',
      textSecondary: '#BE185D',
      border: '#F9A8D4',
      gradient: 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
      glassBg: 'rgba(253, 242, 248, 0.9)',
    },
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('opian-theme') as Theme;
    if (savedTheme && themeConfigs[savedTheme]) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('opian-theme', theme);
    
    // Apply theme colors to CSS custom properties
    const colors = themeConfigs[theme].colors;
    const root = document.documentElement;
    
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
    
    // Apply dark/light mode class
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const value = {
    theme,
    setTheme,
    themes: themeConfigs,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}