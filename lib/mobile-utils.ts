/**
 * Mobile optimization utilities
 */

export const mobileTailwind = {
  // Button sizes - 48px minimum touch target (recommended by Apple HIG)
  buttonBase: 'px-4 py-3 text-base min-h-[48px] flex items-center justify-center rounded-lg transition-colors',
  buttonPrimary: 'bg-[#7DC421] text-white hover:bg-[#6ab01a] active:opacity-90 disabled:opacity-50',
  buttonSecondary: 'border border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100',
  buttonDanger: 'text-red-600 hover:bg-red-50 active:bg-red-100',

  // Input sizes - larger for easier interaction
  input: 'w-full border border-gray-200 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#7DC421]',
  inputError: 'border-red-300 bg-red-50 focus:ring-red-500',

  // Spacing adjustments for mobile
  mobileGutter: 'px-4',
  mobileGap: 'gap-4',

  // Safe area insets (for notch devices)
  safeAreaTop: 'pt-safe',
  safeAreaBottom: 'pb-safe',

  // Touch-friendly spacing
  touchTarget: 'min-h-12 min-w-12',
}

/**
 * Detect if device is mobile
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

/**
 * Format long text for mobile display
 */
export function truncateText(text: string, maxLength: number = 20): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Get optimal grid columns for screen size
 */
export function getGridCols(isMobile: boolean): string {
  return isMobile ? 'grid-cols-1' : 'grid-cols-2'
}

/**
 * Format phone number for display
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length !== 11) return phone

  const area = digits.substring(0, 2)
  const first = digits.substring(2, 7)
  const last = digits.substring(7)

  return `(${area}) ${first}-${last}`
}

/**
 * Make touch events work better
 */
export const touchEventConfig = {
  // Prevent double-tap zoom
  disableDoubleClickZoom: 'user-select-none',

  // Improve button feedback
  activeStateClass: 'active:scale-95 active:opacity-80',

  // Prevent text selection on long press
  preventLongPressSelect: 'touch-none select-none',
}

/**
 * Responsive breakpoint helper
 */
export const breakpoints = {
  xs: '375px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
}
