import { createTheme, alpha } from "@mui/material/styles";
import logger from "../utils/logger";

const getCSSVar = (name, fallback) => {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
};

const getCSSNumber = (name, fallback) => {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = Number.parseFloat(val);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getMuiTheme = () => {
  const root = document.documentElement;
  const isDark = root.getAttribute("data-theme") === "dark";
  logger.debug("Theme updated:", document.documentElement.getAttribute("data-theme"));

  const primary = getCSSVar("--mui-primary-main", "#7F77DD");
  const primaryContrast = getCSSVar("--mui-primary-contrast", "#EEEDFE");
  const success = getCSSVar("--success", "#1D9E75");
  const info = getCSSVar("--info", "#AFA9EC");
  const error = getCSSVar("--error", "#E24B4A");
  const bgDefault = getCSSVar("--mui-bg-default", "#1A1814");
  const bgPaper = getCSSVar("--mui-bg-paper", "#2C2A26");
  const surfaceStrong = getCSSVar("--mui-surface-strong", "#3A3832");
  const textPrimary = getCSSVar("--mui-text-primary", "#EEEDFE");
  const textSecondary = getCSSVar("--mui-text-secondary", "#AFA9EC");
  const divider = getCSSVar("--mui-divider", "rgba(127, 119, 221, 0.15)");
  const borderBright = getCSSVar("--border-bright", "rgba(127, 119, 221, 0.35)");
  const fontBody = getCSSVar("--font-body", "'DM Sans', sans-serif");
  const fontDisplay = getCSSVar("--font-display", "'Cormorant Garamond', serif");
  const radiusS = getCSSVar("--radius-s", "3px");
  const radiusL = getCSSVar("--radius-l", "12px");
  const spacingUnit = getCSSNumber("--space-unit", 8);
  const pageGutter = getCSSVar("--page-gutter", "4rem");
  const contentMax = getCSSVar("--content-max", "1100px");
  const shadowSoft = getCSSVar("--shadow-soft", "0 16px 36px rgba(0, 0, 0, 0.22)");

  return createTheme({
    spacing: spacingUnit,
    palette: {
      mode: isDark ? "dark" : "light",
      primary: { main: primary, contrastText: primaryContrast },
      secondary: { main: textSecondary },
      success: { main: success },
      info: { main: info },
      error: { main: error },
      divider,
      background: {
        default: bgDefault,
        paper: bgPaper,
      },
      text: {
        primary: textPrimary,
        secondary: textSecondary,
      },
    },
    customTokens: {
      surfaces: {
        default: bgDefault,
        paper: bgPaper,
        strong: surfaceStrong,
      },
      borders: {
        subtle: divider,
        bright: borderBright,
      },
      radii: {
        s: radiusS,
        l: radiusL,
      },
      layout: {
        pageGutter,
        contentMax,
      },
    },
    shape: {
      borderRadius: getCSSNumber("--radius-m", 4),
    },
    typography: {
      fontFamily: fontBody,
      h1: {
        fontFamily: fontDisplay,
        fontWeight: 400,
        fontSize: "2.5rem",
        lineHeight: 1.04,
        letterSpacing: "-0.02em",
      },
      h2: {
        fontFamily: fontDisplay,
        fontWeight: 400,
        fontSize: "1.75rem",
        lineHeight: 1.12,
        letterSpacing: "-0.01em",
      },
      h3: {
        fontFamily: fontDisplay,
        fontWeight: 500,
        lineHeight: 1.18,
      },
      h4: {
        fontFamily: fontDisplay,
        fontWeight: 500,
        lineHeight: 1.22,
      },
      h5: {
        fontFamily: fontDisplay,
        fontWeight: 500,
        lineHeight: 1.24,
      },
      h6: {
        fontFamily: fontDisplay,
        fontWeight: 500,
        lineHeight: 1.26,
      },
      subtitle1: {
        fontFamily: fontBody,
        lineHeight: 1.7,
      },
      body1: {
        fontSize: "1rem",
        lineHeight: 1.8,
      },
      body2: {
        lineHeight: 1.7,
      },
      button: {
        fontFamily: fontBody,
        fontWeight: 500,
        letterSpacing: "0.08em",
      },
      overline: {
        fontFamily: fontBody,
        fontWeight: 500,
        letterSpacing: "0.16em",
      },
    },
    components: {
      MuiTextField: {
        defaultProps: {
          variant: "outlined",
          fullWidth: true,
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: radiusS,
            transition: "background-color 0.2s ease, transform 0.1s ease",
            fontWeight: 500,
          },
          containedPrimary: {
            color: primaryContrast,
          },
          outlinedPrimary: {
            color: primary,
            borderColor: primary,
            "&:hover": {
              borderColor: primary,
              backgroundColor: alpha(primary, isDark ? 0.12 : 0.06),
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: `linear-gradient(180deg, ${alpha(primary, isDark ? 0.06 : 0.035)} 0%, ${bgPaper} 18%, ${bgPaper} 100%)`,
            border: `1px solid ${divider}`,
            borderRadius: radiusL,
            boxShadow: shadowSoft,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          colorSuccess: {
            color: "#fff",
            "& .MuiChip-label": { color: "#fff" },
          },
          colorWarning: {
            color: "#fff",
            "& .MuiChip-label": { color: "#fff" },
          },
          colorError: {
            color: "#fff",
            "& .MuiChip-label": { color: "#fff" },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: bgPaper,
            color: textPrimary,
            borderRadius: radiusS,
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: divider,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: primary,
            },
            "&.Mui-focused": {
              backgroundColor: surfaceStrong,
            },
          },
          notchedOutline: {
            borderColor: divider,
          },
          input: {
            fontFamily: fontBody,
            fontWeight: 300,
            "&::placeholder": {
              color: textSecondary,
              opacity: 1,
            },
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: divider,
          },
        },
      },
    },
  });
};
