/**
 * 4Runr Gateway Design Tokens
 * 
 * How to use tokens:
 * 
 * 1. Colors: Use semantic color names (brand, ink, muted, etc.) instead of raw hex codes
 *    Example: className="bg-brand-600 text-ink-900" ✅
 *    Avoid: className="bg-[#6E56CF] text-[#111827]" ❌
 * 
 * 2. Spacing: Use semantic spacing tokens for consistent layouts
 *    Example: className="py-sectionY gap-gridGap" ✅
 *    Avoid: className="py-20 gap-6" ❌
 * 
 * 3. Typography: Use semantic type scale for consistent text hierarchy
 *    Example: className="text-h1 text-ink-900" ✅
 *    Avoid: className="text-4xl font-bold" ❌
 * 
 * 4. Shadows & Radius: Use semantic shadow and radius tokens
 *    Example: className="shadow-lg rounded-xl" ✅
 *    Avoid: className="shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)] rounded-[12px]" ❌
 * 
 * 5. Motion: Use semantic motion tokens for consistent interactions
 *    Example: className="hover:hoverLift focus:focusRing" ✅
 *    Avoid: className="hover:-translate-y-1 focus:ring-2 focus:ring-blue-600" ❌
 */

// ============================================================================
// COLOR TOKENS
// ============================================================================

export const colors = {
  // Brand colors (4Runr primary purple - #6E56CF)
  brand: {
    50: '#f7f5ff',
    100: '#efebff',
    200: '#e2d9ff',
    300: '#ccbbff',
    400: '#b394ff',
    500: '#9b6eff',
    600: '#6E56CF', // 4Runr primary
    700: '#5d47a8',
    800: '#4d3a87',
    900: '#412f70',
  },
  
  // Text colors
  ink: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // Muted/neutral colors
  muted: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  
  // Background colors
  bg: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
    dark: '#111827',
    'dark-secondary': '#1f2937',
  },
  
  // Panel/surface colors
  panel: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
    dark: '#1f2937',
    'dark-secondary': '#374151',
  },
  
  // Border colors (renamed to avoid conflict with CSS variable)
  borderColors: {
    primary: '#e5e7eb',
    secondary: '#d1d5db',
    tertiary: '#9ca3af',
    dark: '#374151',
    'dark-secondary': '#4b5563',
  },
  
  // Semantic colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  
  warn: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
} as const;

// ============================================================================
// SPACING TOKENS
// ============================================================================

export const spacing = {
  sectionY: {
    desktop: '80px',
    mobile: '56px',
  },
  gridGap: '24px',
} as const;

// ============================================================================
// RADIUS TOKENS
// ============================================================================

export const radius = {
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
} as const;

// ============================================================================
// SHADOW TOKENS
// ============================================================================

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

export const typography = {
  h1: {
    fontSize: '2.25rem', // 36px
    lineHeight: '2.5rem', // 40px
    fontWeight: '700',
    letterSpacing: '-0.025em',
  },
  h2: {
    fontSize: '1.875rem', // 30px
    lineHeight: '2.25rem', // 36px
    fontWeight: '600',
    letterSpacing: '-0.025em',
  },
  h3: {
    fontSize: '1.5rem', // 24px
    lineHeight: '2rem', // 32px
    fontWeight: '600',
    letterSpacing: '-0.025em',
  },
  body: {
    fontSize: '1rem', // 16px
    lineHeight: '1.5rem', // 24px
    fontWeight: '400',
  },
  eyebrow: {
    fontSize: '0.875rem', // 14px
    lineHeight: '1.25rem', // 20px
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
} as const;

// ============================================================================
// MOTION TOKENS
// ============================================================================

export const motion = {
  hoverLift: 'translate-y-[1px]',
  focusRing: 'ring-2 ring-brand-600',
} as const;

// ============================================================================
// HELPER GETTERS
// ============================================================================

export const getColor = (colorPath: string) => {
  const path = colorPath.split('.');
  let value: any = colors;
  
  for (const key of path) {
    value = value[key];
    if (value === undefined) {
      throw new Error(`Color token not found: ${colorPath}`);
    }
  }
  
  return value;
};

export const getSpacing = (spacingKey: keyof typeof spacing) => {
  return spacing[spacingKey];
};

export const getRadius = (radiusKey: keyof typeof radius) => {
  return radius[radiusKey];
};

export const getShadow = (shadowKey: keyof typeof shadows) => {
  return shadows[shadowKey];
};

export const getTypography = (typeKey: keyof typeof typography) => {
  return typography[typeKey];
};

export const getMotion = (motionKey: keyof typeof motion) => {
  return motion[motionKey];
};

// ============================================================================
// TAILWIND CLASS HELPERS
// ============================================================================

export const tokenClasses = {
  // Typography classes
  text: {
    h1: 'text-[2.25rem] leading-[2.5rem] font-bold tracking-[-0.025em]',
    h2: 'text-[1.875rem] leading-[2.25rem] font-semibold tracking-[-0.025em]',
    h3: 'text-[1.5rem] leading-[2rem] font-semibold tracking-[-0.025em]',
    body: 'text-base leading-6 font-normal',
    eyebrow: 'text-sm leading-5 font-medium uppercase tracking-[0.05em]',
  },
  
  // Spacing classes
  spacing: {
    sectionY: 'py-20 md:py-[80px]',
    gridGap: 'gap-6',
  },
  
  // Motion classes
  motion: {
    hoverLift: 'hover:-translate-y-[1px] transition-transform duration-200',
    focusRing: 'focus:ring-2 focus:ring-brand-600 focus:outline-none',
  },
} as const;
