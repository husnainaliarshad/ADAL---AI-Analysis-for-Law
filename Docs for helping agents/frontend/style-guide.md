# ADAL Project Style Guide

## Table of Contents
- [Design Tokens](#design-tokens)
- [The Layout Contract](#the-layout-contract)
- [Reusable UI Inventory](#reusable-ui-inventory)
- [Shared Logic](#shared-logic)
- [Typography & Icons](#typography--icons)

---

## Design Tokens

### Color System
The project uses **CSS Custom Properties** (not Tailwind) defined in `src/styles/global.css`:

#### Light Theme Colors
```css
--bg: #FAF9F6;           /* Main background - warm off-white */
--bg-secondary: #F5EDE0;  /* Panel backgrounds - light cream */
--text: #2E2A25;          /* Primary text - dark brown */
--text-muted: #6B5F52;     /* Secondary text - medium brown */
--primary: #B98A48;        /* Brand accent - warm orange/brown */
--primary-hover: #A8783F;   /* Hover state - darker orange */
--border: #E2D8C8;         /* Borders - light gray */
--error: #D45B5B;          /* Error - red */
--success: #C8A477;        /* Success - green */
--info: #E0CCAF;           /* Info - teal accent */
```

#### Dark Theme Colors
```css
--bg: #1A1B1E;           /* Main background - very dark */
--bg-secondary: #2A2B30;  /* Panel backgrounds - dark gray */
--text: #F5F5F5;          /* Primary text - light gray */
--text-muted: #A7A7A7;     /* Secondary text - medium gray */
--primary: #10A37F;        /* Brand accent - blue-green */
--primary-hover: #0E8F6F;   /* Hover state - darker blue-green */
--border: #2E2F33;         /* Borders - dark gray */
--error: #FF5C5C;          /* Error - bright red */
--success: #4ADE80;        /* Success - bright green */
--info: #38BDF8;           /* Info - bright blue */
```

### Spacing System
```css
--space-s: 0.5rem;  /* 8px */
--space-m: 1rem;    /* 16px */
--space-l: 2rem;    /* 32px */
```

### Border Radius
```css
--radius-s: 6px;     /* Small elements */
--radius-m: 10px;    /* Medium elements */
--radius-l: 12px;    /* Large elements */
```

### Typography Scale
```css
--font-heading: 'Merriweather', serif;  /* Professional headings */
--font-body: 'Inter', sans-serif;      /* Clean body text */

/* Font Sizes */
h1: 2.5rem, weight 700;
h2: 1.75rem, weight 600;
h3: 1.4rem, weight 600;
body: 1rem, line-height 1.6;
```

### Theme Switching
- **Attribute-based**: Uses `data-theme="light"` or `data-theme="dark"` on `:root`
- **Automatic**: Detects system preference in `ThemeProvider`
- **Persistent**: Saves to localStorage
- **Smooth**: 0.3s ease transitions

---

## The Layout Contract

### Sidebar Architecture
The `Sidebar.jsx` is a **comprehensive navigation system** with multiple components:

#### Core Components
- `SidebarProvider` - Context provider for state management
- `SidebarBody` - Renders appropriate sidebar based on device
- `DesktopSidebar` - Persistent sidebar with hover expand/collapse
- `MobileSidebar` - Temporary drawer overlay
- `SidebarLink` - Individual navigation items
- `SidebarContent` - Main content structure

#### Responsive Behavior
```javascript
// Breakpoint: md (medium screens)
const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));

// Desktop: Persistent sidebar (240px expanded, 72px collapsed)
// Mobile: Temporary drawer (240px width, overlay)
```

#### Usage Pattern
```jsx
// In layout components
<Sidebar 
  open={mobileOpen} 
  onClose={handleClose} 
  animate={true} // Controls label animations
/>

// Navigation links defined in arrays:
const primaryLinks = [
  { label: "Dashboard", to: ROUTES.DASHBOARD, icon: <DashboardIcon /> },
  // ... more links
];
```

#### State Management
- **Context-based**: Uses `SidebarContext` for open/close state
- **Hover-driven**: Desktop sidebar expands on hover
- **Touch-friendly**: Mobile sidebar with swipe gestures
- **Animated**: Framer Motion for smooth transitions

#### Layout Integration
The sidebar is **designed to be used within a layout wrapper**:
- **Sticky positioning**: `position: sticky, top: 0`
- **Flex container**: Works with main content area
- **Z-index management**: Proper layering for mobile overlay
- **Border integration**: Uses theme-aware borders

---

## Reusable UI Inventory

### Available Components

#### GlowingEffect
**Location**: `src/components/ui/GlowingEffect.jsx`

**Purpose**: Interactive mouse-following glow effect for borders

**Props**:
```jsx
<GlowingEffect
  blur={0}              // Blur intensity
  inactiveZone={0.06}     // Proximity dead zone
  proximity={64}         // Detection radius
  spread={28}            // Glow spread size
  variant="default"      // "default" or "white"
  glow={true}            // Enable/disable effect
  className=""           // Additional CSS classes
  disabled={false}        // Disable interactions
  borderWidth={1.5}      // Border width
>
  {children}
</GlowingEffect>
```

**Usage Patterns**:
- **Card highlights**: Interactive elements with mouse-following glow
- **Active states**: Visual feedback for focused elements
- **Theme-aware**: Adapts colors based on light/dark mode

**CSS Integration**: Uses `glowingEffect.css` with custom CSS variables:
- `--x`, `--y` for mouse position
- `--blur`, `--spot-size` for effect parameters
- `--spot-color`, `--spot-color-mid` for theme colors

### Component Patterns
- **MUI-based**: All UI components extend Material-UI
- **Theme integration**: Uses `getMuiTheme()` for consistent styling
- **CSS variables**: Custom components use global CSS variables
- **Responsive**: Mobile-first approach with MUI breakpoints

---

## Shared Logic

### Context Architecture

#### ThemeContext
**Location**: `src/contexts/ThemeContext.jsx`

**Provider**: `ThemeProvider.jsx`
```javascript
const ThemeContext = createContext({
  mode: "light",
  toggleTheme: () => {},
});

export function useThemeMode() {
  return useContext(ThemeContext);
}
```

**Features**:
- **Mode management**: "light" or "dark"
- **Theme switching**: `toggleTheme()` function
- **System detection**: Respects `prefers-color-scheme`
- **Persistence**: Saves to localStorage

#### SidebarContext
**Location**: Built into `Sidebar.jsx`

**Hooks**:
```javascript
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
};
```

**State Management**:
- **Open/close state**: Boolean with optional prop override
- **Animation control**: `animate` prop for label animations
- **Mobile/desktop**: Different behavior patterns

### Authentication
**Token Storage**: `src/utils/tokenStorage.js`
- **JWT tokens**: Access and refresh token management
- **Local storage**: Persistent authentication state
- **Clear function**: Secure logout handling

**API Integration**: `src/api/authApi.js`
- **Logout endpoint**: Server-side session termination
- **Error handling**: Graceful fallbacks

---

## Typography & Icons

### Icon Library
**Primary**: **Material-UI Icons** (`@mui/icons-material`)

**Common Icons**:
```javascript
import DashboardIcon from "@mui/icons-material/Dashboard";
import DescriptionIcon from "@mui/icons-material/Description";
import GavelIcon from "@mui/icons-material/Gavel";
import EditDocumentIcon from "@mui/icons-material/EditDocument";
import SummarizeIcon from "@mui/icons-material/Summarize";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
```

**Icon Usage Pattern**:
- **Consistent sizing**: Uses `fontSize` prop for variations
- **Theme integration**: Inherits color from MUI theme
- **Semantic meaning**: Icons match functional purpose

### Typography System
**Headings**: Merriweather serif for authority and professionalism
```css
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  color: var(--text);
  line-height: 1.2;
}
```

**Body Text**: Inter sans-serif for readability
```css
p, span, a, li {
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--text-muted);
}
```

**MUI Typography**: Configured in `muiTheme.js`
```javascript
typography: {
  fontFamily: "Inter, Segoe UI, sans-serif",
  h1: {
    fontFamily: "Merriweather, serif",
    fontWeight: 700,
    fontSize: "2.5rem",
  },
  // ... more typography settings
}
```

### Text Hierarchy
1. **H1**: Page titles (2.5rem, 700 weight)
2. **H2**: Section titles (1.75rem, 600 weight)
3. **H3**: Subsection titles (1.4rem, 600 weight)
4. **Body**: Content text (1rem, 1.6 line-height)
5. **Muted**: Secondary information (var(--text-muted))

---

## Development Guidelines

### Adding New Components
1. **Use CSS variables** for colors, spacing, and fonts
2. **Follow MUI patterns** for interactive elements
3. **Implement responsive** design with MUI breakpoints
4. **Add proper TypeScript** (if applicable)
5. **Include accessibility** attributes and ARIA labels

### Theme Considerations
- **Always test** both light and dark modes
- **Use semantic** color variables (primary, success, error)
- **Maintain contrast** ratios for accessibility
- **Consider motion** preferences for animations

### Performance Notes
- **CSS variables** are cached by browser
- **MUI theme** is memoized for performance
- **Framer Motion** uses `will-change` for smooth animations
- **Lazy loading** for heavy components when needed

---

*This style guide is a living document. Update it as the design system evolves.*
