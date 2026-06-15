# ADAL Sidebar Integration Guide

## Overview

This guide explains how to properly integrate the ADAL sidebar into any page component using the exact pattern established in ChatPage.jsx. The sidebar integration follows a specific flex layout hierarchy that ensures consistent positioning, responsive behavior, and proper scrolling behavior.

---

## 🏗️ Core Architecture Pattern

### 1. Import Statement
```javascript
import AppSidebar from '../components/layout/Sidebar';
```

**Key Points:**
- Import `AppSidebar` (the default export) from `../components/layout/Sidebar`
- This component includes the full sidebar with provider, body, and content
- Do not import individual sidebar components like `Sidebar` or `SidebarBody`

### 2. Parent Container Structure
```javascript
return (
  <Box sx={{ 
    display: 'flex',
    flexDirection: 'row',
    height: '100vh',
    backgroundColor: 'var(--bg)',
    overflow: 'hidden'
  }}>
    {/* Sidebar as first child */}
    {/* Main content as second child */}
  </Box>
);
```

**Critical Properties:**
- `display: 'flex'` - Enables flexbox layout
- `flexDirection: 'row'` - Horizontal layout (sidebar left, content right)
- `height: '100vh'` - Full viewport height
- `backgroundColor: 'var(--bg)'` - Uses global CSS variable for theme consistency
- `overflow: 'hidden'` - Prevents entire page from scrolling

---

## 📦 Component Hierarchy

### Level 1: Parent Flex Container
```javascript
<Box sx={{ 
  display: 'flex',
  flexDirection: 'row',
  height: '100vh',
  backgroundColor: 'var(--bg)',
  overflow: 'hidden'
}}>
```

### Level 2: Sidebar (First Child)
```javascript
{/* Sidebar - First child, fixed width */}
<Box sx={{ flexShrink: 0 }}>
  <AppSidebar />
</Box>
```

**Sidebar Properties:**
- `flexShrink: 0` - Prevents sidebar from shrinking
- Fixed width of 240px (handled internally by AppSidebar)
- Position: Left side of viewport
- No additional styling needed

### Level 2: Main Content Area (Second Child)
```javascript
{/* Main Content Area - Second child, takes remaining space */}
<Box sx={{ 
  flexGrow: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden'
}}>
```

**Main Content Properties:**
- `flexGrow: 1` - Takes up all remaining horizontal space
- `minWidth: 0` - Prevents flex overflow issues
- `display: 'flex'` + `flexDirection: 'column'` - Vertical layout for content sections
- `height: '100vh'` - Full height matching parent
- `overflow: 'hidden'` - Prevents main area from scrolling

---

## 🎯 Internal Content Structure

### Header Section (Optional)
```javascript
{/* Header - Fixed at top */}
<Box sx={{ 
  p: 3, 
  borderBottom: `1px solid var(--border)`,
  backgroundColor: 'var(--bg-secondary)',
  flexShrink: 0
}}>
  <Typography variant="h4">Page Title</Typography>
</Box>
```

**Header Properties:**
- `flexShrink: 0` - Prevents header from shrinking
- Fixed positioning at top of main content area
- Uses global CSS variables for consistent theming

### Scrollable Content Area
```javascript
{/* Content - Scrollable middle section */}
<Box sx={{ 
  flex: 1, 
  overflowY: 'auto', 
  p: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: 2
}}>
  {/* Your page content here */}
</Box>
```

**Content Properties:**
- `flex: 1` - Takes up remaining vertical space
- `overflowY: 'auto'` - Enables vertical scrolling only for this section
- All scrolling happens here, not the whole page

### Footer/Input Area (Optional)
```javascript
{/* Footer/Input - Fixed at bottom */}
<Box sx={{ 
  p: 2, 
  borderTop: `1px solid var(--border)`,
  backgroundColor: 'var(--bg-secondary)',
  flexShrink: 0
}}>
  {/* Footer content or input controls */}
</Box>
```

**Footer Properties:**
- `flexShrink: 0` - Prevents footer from shrinking
- Fixed positioning at bottom of main content area
- Stays visible when content scrolls

---

## 🎨 Styling Guidelines

### Use Global CSS Variables
Always use the ADAL global CSS variables for consistent theming:

```javascript
backgroundColor: 'var(--bg)'           // Main background
backgroundColor: 'var(--bg-secondary)'  // Panel backgrounds
color: 'var(--text)'                   // Primary text
color: 'var(--text-muted)'            // Secondary text
border: `1px solid var(--border)`     // Consistent borders
backgroundColor: 'var(--primary)'      // Brand accent
fontFamily: 'var(--font-body)'        // Inter font
fontFamily: 'var(--font-heading)'     // Merriweather font
borderRadius: 'var(--radius-m)'       // 10px radius
```

### Responsive Design
The sidebar automatically handles responsive behavior:
- **Desktop**: Persistent sidebar with hover expand/collapse
- **Mobile**: Temporary drawer overlay (handled internally by AppSidebar)
- **No additional responsive code needed** in your page component

---

## 📋 Complete Template

```javascript
import React from 'react';
import { Box, Typography } from '@mui/material';
import AppSidebar from '../components/layout/Sidebar';

const YourPage = () => {
  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'row',
      height: '100vh',
      backgroundColor: 'var(--bg)',
      overflow: 'hidden'
    }}>
      {/* Sidebar - First child, fixed width */}
      <Box sx={{ flexShrink: 0 }}>
        <AppSidebar />
      </Box>

      {/* Main Content Area - Second child, takes remaining space */}
      <Box sx={{ 
        flexGrow: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden'
      }}>
        {/* Header - Optional */}
        <Box sx={{ 
          p: 3, 
          borderBottom: `1px solid var(--border)`,
          backgroundColor: 'var(--bg-secondary)',
          flexShrink: 0
        }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontFamily: 'var(--font-heading)',
              color: 'var(--text)'
            }}
          >
            Your Page Title
          </Typography>
        </Box>

        {/* Content - Scrollable */}
        <Box sx={{ 
          flex: 1, 
          overflowY: 'auto', 
          p: 2
        }}>
          {/* Your page content goes here */}
          <Typography sx={{ fontFamily: 'var(--font-body)' }}>
            Your content...
          </Typography>
        </Box>

        {/* Footer - Optional */}
        <Box sx={{ 
          p: 2, 
          borderTop: `1px solid var(--border)`,
          backgroundColor: 'var(--bg-secondary)',
          flexShrink: 0
        }}>
          {/* Footer content */}
        </Box>
      </Box>
    </Box>
  );
};

export default YourPage;
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ Incorrect: Wrapping content in sidebar components
```javascript
// WRONG - Don't do this
<Sidebar>
  <SidebarBody>
    <YourContent />
  </SidebarBody>
</Sidebar>
```

### ✅ Correct: Sidebar as sibling to content
```javascript
// RIGHT - Do this
<Box sx={{ display: 'flex', flexDirection: 'row' }}>
  <AppSidebar />
  <YourContent />
</Box>
```

### ❌ Incorrect: Missing flex properties
```javascript
// WRONG - Will cause layout issues
<Box>
  <AppSidebar />
  <YourContent />
</Box>
```

### ✅ Correct: Proper flex hierarchy
```javascript
// RIGHT - Proper layout
<Box sx={{ display: 'flex', flexDirection: 'row', height: '100vh' }}>
  <Box sx={{ flexShrink: 0 }}>
    <AppSidebar />
  </Box>
  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
    <YourContent />
  </Box>
</Box>
```

---

## 🔍 Integration Checklist

- [ ] Import `AppSidebar` from `../components/layout/Sidebar`
- [ ] Create parent Box with `display: 'flex'` and `flexDirection: 'row'`
- [ ] Set parent height to `100vh` and `overflow: 'hidden'`
- [ ] Place sidebar in first child Box with `flexShrink: 0`
- [ ] Place main content in second child Box with `flexGrow: 1` and `minWidth: 0`
- [ ] Use `var(--bg)` and other global CSS variables
- [ ] Set main content to `display: 'flex', flexDirection: 'column'`
- [ ] Make scrollable content area with `flex: 1` and `overflowY: 'auto'`
- [ ] Use `flexShrink: 0` for header/footer sections

---

## 🎯 Benefits of This Pattern

1. **Consistent Layout**: All pages have identical sidebar behavior
2. **Proper Scrolling**: Only content areas scroll, not the whole page
3. **Responsive Design**: Mobile/desktop handled automatically
4. **Theme Integration**: Uses global CSS variables for consistent styling
5. **Performance**: Efficient flex layout with minimal reflows
6. **Accessibility**: Proper semantic structure and keyboard navigation

---

*This guide is based on the exact implementation pattern used in ChatPage.jsx. Follow this structure precisely for consistent behavior across all ADAL pages.*
