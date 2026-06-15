/**
 * SystemStatus Component
 * Displays backend health information from /health.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, Divider, Stack, Typography, Box, alpha, useTheme, Chip } from "@mui/material";
import { formatDate } from "../../../utils/helpers";
import axiosClient from "../../../api/axiosClient";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import SyncIcon from "@mui/icons-material/Sync";
import QueueIcon from "@mui/icons-material/Queue";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import logger from "../../../utils/logger";

const boolStatus = (value) => (value ? "success" : "error");
const boolLabel = (value, trueLabel = "Healthy", falseLabel = "Unavailable") => (
  value ? trueLabel : falseLabel
);

export default function SystemStatus() {
  const theme = useTheme();
  const accentMain = theme.palette.primary.main;
  const [health, setHealth] = useState(null);
  const [healthUnavailable, setHealthUnavailable] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await axiosClient.get('/health');
        setHealth(res?.data || null);
        setHealthUnavailable(false);
      } catch (err) {
        logger.warn('[SystemStatus] Failed to fetch health check:', err);
        setHealth(null);
        setHealthUnavailable(true);
      }
    };

    fetchHealth();
  }, []);

  const statusItems = useMemo(() => {
    const checks = health?.checks || {};

    if (healthUnavailable) {
      return [
        {
          label: "API Server",
          value: "Unavailable",
          status: "error",
          icon: <ErrorOutlineIcon sx={{ fontSize: 20 }} />,
        },
        {
          label: "Database",
          value: "Unavailable",
          status: "error",
          icon: <CloudDoneIcon sx={{ fontSize: 20 }} />,
        },
        {
          label: "Last Sync",
          value: "Unavailable",
          status: "error",
          icon: <SyncIcon sx={{ fontSize: 20 }} />,
        },
        {
          label: "Processing Queue",
          value: "N/A",
          status: "info",
          icon: <QueueIcon sx={{ fontSize: 20 }} />,
        },
      ];
    }

    return [
      {
        label: "API Server",
        value: boolLabel(checks.server),
        status: boolStatus(checks.server),
        icon: <CheckCircleIcon sx={{ fontSize: 20 }} />,
      },
      {
        label: "Database",
        value: boolLabel(checks.database),
        status: boolStatus(checks.database),
        icon: <CloudDoneIcon sx={{ fontSize: 20 }} />,
      },
      {
        label: "Last Sync",
        value: health?.timestamp ? formatDate(new Date(health.timestamp)) : "Unavailable",
        status: health?.timestamp ? "info" : "error",
        icon: <SyncIcon sx={{ fontSize: 20 }} />,
      },
      {
        label: "Processing Queue",
        value: "N/A",
        status: "info",
        icon: <QueueIcon sx={{ fontSize: 20 }} />,
      },
    ];
  }, [health, healthUnavailable]);

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.12)}`,
        boxShadow: `0 16px 32px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.06)}`,
        background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.06 : 0.04)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 22%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${alpha(accentMain, 0.9)} 38%, transparent 100%)`,
        },
      }}
    >
      <CardContent sx={{ p: 3, position: "relative", zIndex: 1 }}>
        <Box sx={{ display: "grid", gap: 0.25, mb: 2 }}>
          <Typography
            sx={{
              fontSize: "0.68rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "text.secondary",
              fontWeight: 600,
            }}
          >
            Health
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: { xs: "1.1rem", md: "1.25rem" },
            }}
          >
            System Status
          </Typography>
          <Typography
            sx={{
              color: "text.secondary",
              fontSize: "0.8rem",
              lineHeight: 1.6,
            }}
          >
            Backend availability and basic service health for this workspace.
          </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <Stack spacing={2.5}>
          {statusItems.map((item) => (
            <Box
              key={item.label}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                py: 1,
                px: 1.5,
                borderRadius: 1.5,
                transition: "all 0.2s ease",
                "&:hover": {
                  bgcolor: alpha(accentMain, 0.05),
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box
                  sx={{
                    p: 0.75,
                    borderRadius: 1,
                    bgcolor:
                      item.status === "success"
                        ? alpha(accentMain, 0.1)
                        : item.status === "error"
                        ? alpha(theme.palette.error.main, 0.1)
                        : alpha(accentMain, 0.05),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    "& svg": {
                      color:
                        item.status === "success"
                          ? accentMain
                          : item.status === "error"
                          ? theme.palette.error.main
                          : theme.palette.text.secondary,
                    },
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {item.label}
                </Typography>
              </Box>
              {item.status === "success" || item.status === "error" ? (
                <Chip
                  label={item.value}
                  size="small"
                  icon={item.status === "success" ? <CheckCircleIcon /> : <ErrorOutlineIcon />}
                  sx={{
                    bgcolor:
                      item.status === "success"
                        ? alpha(accentMain, 0.1)
                        : alpha(theme.palette.error.main, 0.12),
                    color:
                      item.status === "success"
                        ? accentMain
                        : theme.palette.error.main,
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    height: 24,
                    "& .MuiChip-icon": {
                      color:
                        item.status === "success"
                          ? accentMain
                          : theme.palette.error.main,
                      fontSize: 16,
                    },
                  }}
                />
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: "text.primary",
                    fontSize: "0.875rem",
                  }}
                >
                  {item.value}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
