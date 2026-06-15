import React from "react";
import { Box, Typography, alpha, useTheme } from "@mui/material";
import GlowingEffect from "./GlowingEffect";

const toneMap = (theme) => ({
  primary: {
    border: alpha(theme.palette.primary.main, 0.2),
    background: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.96 : 0.985),
    iconBg: alpha(theme.palette.primary.main, 0.12),
    iconColor: theme.palette.primary.main,
    chipBg: alpha(theme.palette.primary.main, 0.12),
    chipColor: theme.palette.primary.main,
  },
  success: {
    border: alpha(theme.palette.success.main, 0.22),
    background: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.96 : 0.985),
    iconBg: alpha(theme.palette.success.main, 0.12),
    iconColor: theme.palette.success.main,
    chipBg: alpha(theme.palette.success.main, 0.12),
    chipColor: theme.palette.success.main,
  },
  warning: {
    border: alpha(theme.palette.warning.main, 0.22),
    background: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.96 : 0.985),
    iconBg: alpha(theme.palette.warning.main, 0.12),
    iconColor: theme.palette.warning.main,
    chipBg: alpha(theme.palette.warning.main, 0.12),
    chipColor: theme.palette.warning.main,
  },
  danger: {
    border: alpha(theme.palette.error.main, 0.24),
    background: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.96 : 0.985),
    iconBg: alpha(theme.palette.error.main, 0.12),
    iconColor: theme.palette.error.main,
    chipBg: alpha(theme.palette.error.main, 0.12),
    chipColor: theme.palette.error.main,
  },
  neutral: {
    border: alpha(theme.palette.primary.main, 0.14),
    background: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.96 : 0.985),
    iconBg: alpha(theme.palette.primary.main, 0.08),
    iconColor: theme.palette.text.primary,
    chipBg: alpha(theme.palette.text.secondary, 0.1),
    chipColor: theme.palette.text.secondary,
  },
});

export default function GlowingEffectCard({
  icon,
  title,
  description,
  eyebrow,
  badge,
  tone = "primary",
  value,
  footer,
  children,
  onClick,
  minHeight = 224,
  className,
  sx,
}) {
  const theme = useTheme();
  const styles = toneMap(theme)[tone] || toneMap(theme).primary;

  return (
    <Box
      className={className}
      onClick={onClick}
      sx={{
        position: "relative",
        minHeight,
        height: "100%",
        listStyle: "none",
        cursor: onClick ? "pointer" : "default",
        ...sx,
      }}
    >
      <Box
        sx={{
          position: "relative",
          height: "100%",
          borderRadius: { xs: "20px", md: "24px" },
          border: `1px solid ${styles.border}`,
          p: { xs: 1.1, md: 1.3 },
          background: alpha(theme.palette.background.default, theme.palette.mode === "dark" ? 0.36 : 0.6),
          boxShadow: `0 18px 36px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.22 : 0.08)}`,
          transition: "transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease",
          "&:hover": onClick
            ? {
                transform: "translateY(-3px)",
                borderColor: alpha(theme.palette.primary.main, 0.3),
                boxShadow: `0 22px 42px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.28 : 0.12)}`,
              }
            : undefined,
        }}
      >
        <GlowingEffect
          spread={26}
          glow
          disabled={false}
          proximity={56}
          inactiveZone={0.1}
          borderWidth={1.15}
        />
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            height: "100%",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 2.2,
            overflow: "hidden",
            borderRadius: { xs: "16px", md: "18px" },
            p: { xs: 2.1, md: 2.35 },
            background: styles.background,
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.25 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid ${alpha(styles.iconColor, 0.18)}`,
                  bgcolor: styles.iconBg,
                  color: styles.iconColor,
                  flexShrink: 0,
                  "& svg": {
                    fontSize: 20,
                  },
                }}
              >
                {icon}
              </Box>
              {badge ? (
                <Box
                  sx={{
                    px: 1,
                    py: 0.55,
                    borderRadius: "999px",
                    bgcolor: styles.chipBg,
                    color: styles.chipColor,
                    border: `1px solid ${alpha(styles.chipColor, 0.16)}`,
                    fontSize: "0.66rem",
                    lineHeight: 1,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {badge}
                </Box>
              ) : null}
            </Box>

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 1.4 }}>
              <Box sx={{ display: "grid", gap: 0.9 }}>
                {eyebrow ? (
                  <Typography
                    sx={{
                      fontSize: "0.66rem",
                      lineHeight: 1,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "text.secondary",
                      fontWeight: 700,
                    }}
                  >
                    {eyebrow}
                  </Typography>
                ) : null}
                {value != null ? (
                  <Typography
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontSize: { xs: "2.05rem", md: "2.35rem" },
                      lineHeight: 0.92,
                      color: "text.primary",
                    }}
                  >
                    {value}
                  </Typography>
                ) : null}
                <Typography
                  sx={{
                    fontFamily: "var(--font-body)",
                    fontSize: value != null ? { xs: "1.02rem", md: "1.14rem" } : { xs: "1.14rem", md: "1.28rem" },
                    lineHeight: 1.32,
                    fontWeight: 700,
                    color: "text.primary",
                    textWrap: "balance",
                  }}
                >
                  {title}
                </Typography>
                {description ? (
                  <Typography
                    sx={{
                      fontSize: "0.84rem",
                      lineHeight: 1.68,
                      color: "text.secondary",
                    }}
                  >
                    {description}
                  </Typography>
                ) : null}
              </Box>

              {children ? <Box>{children}</Box> : null}
            </Box>
          </Box>

          {footer ? <Box sx={{ mt: "auto" }}>{footer}</Box> : null}
        </Box>
      </Box>
    </Box>
  );
}
