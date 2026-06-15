import React from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/**
 * ADAL logo component - supports full (icon + wordmark) or icon-only variants
 */
export default function AdalLogo({ variant = "full", height = 40, sx = {} }) {
  const theme = useTheme();
  const isFull = variant === "full";
  const isLightMode = theme.palette.mode === "light";
  const assetName = isFull
    ? (isLightMode ? "/adal-logo-light.svg" : "/adal-logo.svg")
    : (isLightMode ? "/adal-icon-light.svg" : "/adal-icon.svg");

  return (
    <Box
      component="img"
      src={assetName}
      alt="ADAL"
      sx={{
        height: isFull ? height : Math.min(height, 36),
        width: "auto",
        display: "block",
        objectFit: "contain",
        ...sx,
      }}
    />
  );
}
