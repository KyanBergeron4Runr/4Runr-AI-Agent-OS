/**
 * useScrollHeader Hook
 * 
 * Provides scroll-based header styling for navbar components.
 * Toggles a 'scrolled' state that applies blurred translucent background,
 * subtle shadow, and top border using design tokens.
 */

import { useEffect, useState } from 'react';

interface UseScrollHeaderOptions {
  /**
   * Scroll threshold in pixels before applying scrolled styles
   * @default 10
   */
  threshold?: number;
  
  /**
   * Whether the hook should be active
   * @default true
   */
  enabled?: boolean;
}

interface UseScrollHeaderReturn {
  /**
   * Whether the header should show scrolled styles
   */
  isScrolled: boolean;
  
  /**
   * CSS classes to apply to the header element
   */
  headerClasses: string;
  
  /**
   * Current scroll position
   */
  scrollY: number;
}

/**
 * Hook for managing scroll-based header styling
 * 
 * @example
 * ```tsx
 * function Navbar() {
 *   const { isScrolled, headerClasses } = useScrollHeader();
 *   
 *   return (
 *     <header className={`fixed top-0 w-full z-50 transition-all duration-200 ${headerClasses}`}>
 *       <nav>...</nav>
 *     </header>
 *   );
 * }
 * ```
 */
export function useScrollHeader(options: UseScrollHeaderOptions = {}): UseScrollHeaderReturn {
  const { threshold = 10, enabled = true } = options;
  
  const [scrollY, setScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setIsScrolled(currentScrollY > threshold);
    };
    
    // Set initial scroll position
    handleScroll();
    
    // Add scroll listener with passive option for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold, enabled]);
  
  // Generate CSS classes based on scroll state
  const headerClasses = isScrolled
    ? [
        // Translucent blurred background
        'bg-bg-primary/80',
        'backdrop-blur-md',
        
        // Subtle shadow using design tokens
        'shadow-sm',
        
        // Top border for definition
        'border-t',
        'border-borderColors-primary/20',
        
        // Bottom border for separation
        'border-b',
        'border-borderColors-primary/10',
      ].join(' ')
    : [
        // Default transparent background
        'bg-transparent',
        
        // No shadow or borders when not scrolled
        'border-transparent',
      ].join(' ');
  
  return {
    isScrolled,
    headerClasses,
    scrollY,
  };
}

/**
 * Hook for managing scroll direction detection
 * Useful for hiding/showing header based on scroll direction
 */
export function useScrollDirection(threshold: number = 10) {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [prevScrollY, setPrevScrollY] = useState(0);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (Math.abs(currentScrollY - prevScrollY) < threshold) {
        return;
      }
      
      setScrollDirection(currentScrollY > prevScrollY ? 'down' : 'up');
      setPrevScrollY(currentScrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [prevScrollY, threshold]);
  
  return { scrollDirection, scrollY: prevScrollY };
}

/**
 * Hook for scroll-to-top functionality
 */
export function useScrollToTop() {
  const scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: 0,
        behavior,
      });
    }
  };
  
  return { scrollToTop };
}
