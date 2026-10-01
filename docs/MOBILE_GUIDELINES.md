# Mobile Optimization Guidelines

## Overview
This document outlines best practices for optimizing the Boa Bola Beach app for mobile devices.

## Touch Targets
- **Minimum size**: 48px × 48px (Apple HIG standard)
- Apply to: buttons, links, form inputs, interactive elements
- Example: `min-h-[48px]` and `min-w-[48px]`

## Layout Principles

### 1. Sidebar (Mobile)
- Use MobileSidebar component in mobile view
- Drawer navigation (slides from left)
- Hamburger menu icon in header
- Only visible when toggled

```tsx
import { MobileSidebar } from '@/components/layout/MobileSidebar'

<MobileSidebar />
```

### 2. Tables (Mobile)
- Use MobileTable component for mobile view
- Card-based layout instead of HTML table
- Each row = one card with label-value pairs

```tsx
import { MobileTable } from '@/components/ui/mobile-table'

<MobileTable
  columns={[
    { key: 'nome', label: 'Nome' },
    { key: 'valor', label: 'Valor' },
  ]}
  data={data}
/>
```

### 3. Forms (Mobile)
- Stack inputs vertically
- Use full width
- Larger padding: `py-3` minimum
- 48px minimum button heights
- Show one error per field

### 4. Spacing
- Mobile gutter: `px-4` (16px)
- Gap between elements: `gap-4`
- Increased padding around buttons and inputs

## Responsive Classes

### Grid Layout
```tsx
// 1 column on mobile, 2+ on desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

### Button Sizing
```tsx
// Mobile-optimized button
<button className="px-4 py-3 text-base min-h-[48px] rounded-lg">
  Ação
</button>
```

### Input Sizing
```tsx
// Mobile-friendly input
<input className="w-full border rounded-lg px-4 py-3 text-base" />
```

## Performance Tips

1. **Lazy Load Images**
   ```tsx
   <img loading="lazy" src="..." />
   ```

2. **Minimize Reflows**
   - Avoid layout shifts
   - Use fixed heights when possible
   - Pre-calculate card heights

3. **Optimize Gráficos**
   - Reduce data points on mobile
   - Use smaller chart heights
   - Disable animations on low-end devices

## Testing Checklist

- [ ] Test at 375px width (iPhone SE)
- [ ] Test at 768px width (iPad)
- [ ] Test on actual devices
- [ ] Check touch target sizes (minimum 48px)
- [ ] Verify no horizontal scroll
- [ ] Test form inputs (keyboard display)
- [ ] Test navigation (drawer opens/closes)
- [ ] Check image loading times
- [ ] Verify gráficos render properly

## Common Issues & Solutions

### Issue: Horizontal Scroll
**Solution**: Remove fixed widths, use `w-full`, check for overflowing elements

### Issue: Small Buttons (Hard to tap)
**Solution**: Use `min-h-[48px]` and increase padding

### Issue: Hidden Navigation
**Solution**: Use MobileSidebar drawer instead of desktop sidebar

### Issue: Unreadable Tables
**Solution**: Switch to MobileTable card layout

### Issue: Slow Performance
**Solution**: Implement pagination, lazy loading, image optimization

## Utilities Available

```tsx
import { mobileTailwind, isMobile, truncateText } from '@/lib/mobile-utils'

// Use in components
const buttonClass = `${mobileTailwind.buttonBase} ${mobileTailwind.buttonPrimary}`

// Check if device is mobile
if (isMobile()) {
  // Show mobile-specific UI
}

// Truncate long text
const shortName = truncateText(fullName, 15)
```

## Browser Support

- iOS Safari 14+
- Chrome Mobile 90+
- Firefox Mobile 88+
- Samsung Internet 14+

## Next Steps

1. [ ] Apply MobileSidebar to layout
2. [ ] Update all tables to use MobileTable on mobile
3. [ ] Review all buttons for 48px minimum
4. [ ] Test on real devices
5. [ ] Monitor Core Web Vitals
