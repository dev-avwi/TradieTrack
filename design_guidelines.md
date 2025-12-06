# TradieTrack Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing inspiration from productivity tools like Linear, Notion, and Asana, combined with professional service platforms. This utility-focused app prioritizes efficiency and learnability for busy tradespeople.

## Core Design Elements

### Color Palette
**Primary Colors:**
- Light mode: 220 15% 15% (charcoal blue)
- Dark mode: 210 20% 95% (light blue-white)

**Secondary Colors:**
- Success: 145 65% 45% (professional green)
- Warning: 35 90% 55% (amber)
- Danger: 5 85% 55% (red)

**Backgrounds:**
- Light mode: 0 0% 98% (off-white)
- Dark mode: 220 15% 8% (deep charcoal)

### Typography
**Font Family:** Inter via Google Fonts CDN
- Headings: 600-700 weight
- Body text: 400-500 weight
- Small text/labels: 400 weight
- Mobile: 14px base, Desktop: 16px base

### Layout System
**Spacing Scale:** Consistent rhythm using gap-4 and space-y-6
- Component spacing within cards: gap-3, gap-4
- Section spacing (vertical): space-y-4 on mobile, space-y-6 on desktop (md:space-y-6)
- Grid gaps: gap-4 for all responsive grids
- Card padding: p-4 on mobile, p-6 on desktop (md:p-6)
- Page container: p-4 md:p-6 for all list pages

**Responsive Grid Patterns:**
- Mobile: 1 column (grid-cols-1)
- Tablet: 2 columns (sm:grid-cols-2 or md:grid-cols-2)
- Desktop: 3 columns (lg:grid-cols-3)
- Always use gap-4 for consistent spacing between grid items

### Component Library

**Navigation:**
- Mobile: Bottom tab bar with 5 icons (Dashboard, Jobs, Clients, Quotes, Calendar)
- Desktop: Collapsible sidebar with same sections
- Icons from Heroicons (outline style)

**Cards & Containers:**
- Use shadcn Card component for all card-based layouts
- Card headers: `<CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">`
- Card content: Standard padding via CardContent (p-6)
- Hover states: Apply `hover-elevate active-elevate-2` to interactive cards
- Never nest Cards within Cards
- Subtle shadows: shadow-sm (handled by Card component)
- Rounded corners: rounded-lg (handled by Card component)
- Clean borders in light mode, subtle outlines in dark mode (handled by Card component)

**Quick Action Cards Pattern:**
- Use Card + Button composition for accessibility
- Button: `variant="ghost"` with `className="w-full h-auto p-6 flex flex-col items-center gap-3 text-center hover:bg-transparent no-default-hover-elevate no-default-active-elevate"`
- Card handles hover/active elevation via `hover-elevate active-elevate-2`
- Icon container: `w-14 h-14 rounded-xl` with background color
- Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

**Forms:**
- Single-column layouts on mobile
- Two-column on desktop for longer forms
- Prominent CTAs with primary color
- Clear field labels and validation states

**Data Tables:**
- Card-based layout on mobile (stacked)
- Traditional table on desktop
- Status badges with appropriate colors
- Quick action buttons (outline style)

**Buttons:**
- Primary: Solid background with primary color
- Secondary: Outline style with transparent background
- When placed over images: Use outline variant with backdrop-blur

## Mobile-First Considerations
- Touch-friendly 44px minimum tap targets
- Swipe gestures for job status updates
- Pull-to-refresh on list views
- Floating action buttons for primary actions

## Professional Aesthetics
- Clean, minimal interface with ample whitespace
- Consistent iconography throughout
- Professional color scheme suitable for business use
- Clear visual hierarchy with proper contrast ratios
- Subtle animations only for state changes and loading

## Images
**No large hero images required** - This is a utility-focused business application. Use:
- Small avatar placeholders for clients
- Job photo thumbnails in cards
- Company logo upload in settings
- Icon-based visual hierarchy instead of decorative imagery

The design emphasizes functionality and efficiency over visual flair, ensuring tradespeople can quickly complete tasks and manage their business effectively.