/**
 * StatsCard Component
 * Displays a single statistic card with icon, title, value, and optional footer
 * 
 * @param {string} title - The title/label for the stat card
 * @param {string|number} value - The value to display
 * @param {React.ReactNode} icon - Icon component to display
 * @param {React.ReactNode} footer - Optional footer content (e.g., progress bar)
 * @param {string} color - Color theme ('primary', 'success', 'info', 'warning', 'error')
 */
import React from "react";
import { Card, CardContent, Stack, Typography, Box, alpha, useTheme } from "@mui/material";

export default function StatsCard({ title, value, icon, footer, color = "primary" }) {
  const theme = useTheme();
  
  const colorMap = {
    primary: theme.palette.primary.main,
    success: theme.palette.success.main,
    info: theme.palette.info.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
  };
  
  const iconColor = colorMap[color] || colorMap.success;

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.12)}`,
        boxShadow: `0 16px 32px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.06)}`,
        background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.06 : 0.04)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 22%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
        transition: "all 0.3s ease",
        "&:hover": {
          boxShadow: `0 18px 36px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.26 : 0.08)}`,
          borderColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.28 : 0.18),
          transform: "translateY(-2px)",
        },
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${alpha(theme.palette.primary.main, 0.9)} 38%, transparent 100%)`,
        },
      }}
    >
      <CardContent sx={{ p: 3, position: "relative", zIndex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              fontSize: "0.74rem",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "text.secondary",
            }}
          >
            {title}
          </Typography>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              bgcolor: alpha(iconColor, 0.12),
              border: `1px solid ${alpha(iconColor, 0.18)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              "& svg": {
                fontSize: 20,
                color: iconColor,
              },
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Typography
          variant="h4"
          sx={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            mb: footer ? 1.5 : 0,
            fontSize: { xs: "2rem", md: "2.2rem" },
            color: "text.primary",
            lineHeight: 0.95,
          }}
        >
          {value}
        </Typography>
        {footer && (
          <Box sx={{ mt: 1 }}>
            {footer}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
