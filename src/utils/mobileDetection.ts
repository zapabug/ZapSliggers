export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false; // Not in a browser environment

  // Basic check using user agent string - common patterns
  const userAgent = navigator.userAgent || navigator.vendor || "";

  // Regular expression to check for common mobile identifiers
  return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
} 