import { useState, useEffect } from 'react';

// Unified map theme configuration
export const mapThemes = {
  dark: {
    // Container
    water: 'bg-[#1e3a5f]',
    waterHex: '#1e3a5f',

    // Geography
    land: '#4a6274',
    landHover: '#5d7486',
    stroke: '#5d7486',
    strokeWidth: 0.4,

    // Labels
    labelDefault: '#d1d5db',
    labelActive: '#fff',
    timeLabel: '#9ca3af',
    textShadow: '0 2px 4px rgba(0,0,0,0.9)',

    // Markers
    markerStroke: '#fff',
    markerStrokeHover: 'rgba(255,255,255,0.6)',
    markerStrokeDefault: 'rgba(255,255,255,0.3)',
    glowOpacity: 0.6,
    glowOpacityHover: 0.8,

    // Tooltip
    tooltipBg: 'rgba(0,0,0,0.9)',
    tooltipText: '#fff',

    // Info Panel (selected item details)
    infoPanelBg: 'bg-black/40',
    infoPanelBorder: 'border-gray-800/40',
    infoPanelTextPrimary: 'text-gray-100',
    infoPanelTextSecondary: 'text-gray-300',
    infoPanelTextMuted: 'text-gray-400',
  },
  light: {
    // Container
    water: 'bg-[#b8d4e3]',
    waterHex: '#b8d4e3',

    // Geography
    land: '#e8e4da',
    landHover: '#ddd9cf',
    stroke: '#c5c1b7',
    strokeWidth: 0.4,

    // Labels
    labelDefault: '#1f2937',
    labelActive: '#000',
    timeLabel: '#374151',
    textShadow: '0 1px 2px rgba(255,255,255,0.8)',

    // Markers
    markerStroke: '#1f2937',
    markerStrokeHover: 'rgba(0,0,0,0.5)',
    markerStrokeDefault: 'rgba(0,0,0,0.3)',
    glowOpacity: 0.7,
    glowOpacityHover: 0.9,

    // Tooltip
    tooltipBg: 'rgba(255,255,255,0.95)',
    tooltipText: '#1f2937',

    // Info Panel (selected item details) - solid dark bg for contrast
    infoPanelBg: 'bg-slate-800',
    infoPanelBorder: 'border-slate-700',
    infoPanelTextPrimary: 'text-white',
    infoPanelTextSecondary: 'text-slate-200',
    infoPanelTextMuted: 'text-slate-300',
  },
};

export type MapTheme = typeof mapThemes.dark;

// Unified map dimensions
export const mapDimensions = {
  height: 'h-[200px] sm:h-[240px]',
  heightPx: { mobile: 200, desktop: 240 },
};

// Custom hook for theme detection
export function useMapTheme(): { isDarkMode: boolean; theme: MapTheme } {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  return {
    isDarkMode,
    theme: isDarkMode ? mapThemes.dark : mapThemes.light,
  };
}
