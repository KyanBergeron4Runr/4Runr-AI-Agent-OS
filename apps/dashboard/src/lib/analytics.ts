/**
 * Analytics Helper
 * 
 * Provides utilities for tracking user interactions throughout the application.
 * All clicks are tracked with data-analytics-id attributes for easy identification.
 */

interface ClickEvent {
  id: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
}

/**
 * Track a click event with analytics
 * @param event - The click event details
 */
export function trackClick(event: ClickEvent): void {
  // In a real application, this would send to your analytics provider
  // (Google Analytics, Mixpanel, Segment, etc.)
  
  if (typeof window !== 'undefined') {
    // Log for development
    console.log('[Analytics] Click tracked:', event);
    
    // Example implementation for different analytics providers:
    
    // Google Analytics 4
    if ('gtag' in window) {
      (window as any).gtag('event', event.action, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        custom_id: event.id,
      });
    }
    
    // Mixpanel
    if ('mixpanel' in window) {
      (window as any).mixpanel.track(event.action, {
        category: event.category,
        label: event.label,
        value: event.value,
        id: event.id,
      });
    }
    
    // Custom analytics endpoint
    try {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...event,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {
        // Silently fail - analytics shouldn't break the app
      });
    } catch (error) {
      // Silently fail - analytics shouldn't break the app
    }
  }
}

/**
 * Track navigation clicks
 * @param linkId - The analytics ID of the navigation link
 * @param destination - The destination URL or route
 */
export function trackNavigation(linkId: string, destination: string): void {
  trackClick({
    id: linkId,
    category: 'navigation',
    action: 'nav_click',
    label: destination,
  });
}

/**
 * Track CTA button clicks
 * @param ctaId - The analytics ID of the CTA button
 * @param ctaType - Primary or secondary CTA
 * @param destination - The destination URL or route
 */
export function trackCTA(ctaId: string, ctaType: 'primary' | 'secondary', destination: string): void {
  trackClick({
    id: ctaId,
    category: 'cta',
    action: 'cta_click',
    label: `${ctaType}_${destination}`,
  });
}

/**
 * Track mobile menu interactions
 * @param action - The action performed (open, close, link_click)
 * @param label - Additional context
 */
export function trackMobileMenu(action: 'open' | 'close' | 'link_click', label?: string): void {
  trackClick({
    id: 'mobile_menu',
    category: 'mobile',
    action: `mobile_menu_${action}`,
    label,
  });
}

/**
 * Higher-order component for automatically tracking clicks
 * @param Component - The component to wrap
 * @param analyticsId - The analytics ID to use
 * @param category - The analytics category
 * @returns Wrapped component with click tracking
 */
export function withClickTracking<T extends { onClick?: () => void }>(
  Component: React.ComponentType<T>,
  analyticsId: string,
  category: string = 'interaction'
) {
  return function TrackedComponent(props: T) {
    const handleClick = () => {
      trackClick({
        id: analyticsId,
        category,
        action: 'click',
      });
      
      if (props.onClick) {
        props.onClick();
      }
    };
    
    return React.createElement(Component, {
      ...props,
      onClick: handleClick,
      'data-analytics-id': analyticsId,
    });
  };
}

/**
 * Hook for tracking page views
 * @param pageName - The name of the page
 * @param additionalData - Additional tracking data
 */
export function usePageTracking(pageName: string, additionalData?: Record<string, any>) {
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      trackClick({
        id: `page_${pageName}`,
        category: 'page_view',
        action: 'page_view',
        label: pageName,
      });
    }
  }, [pageName]);
}

// Re-export React for the withClickTracking HOC
import React from 'react';
