import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Chip,
  Skeleton,
  Stack,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { motion as Motion } from "framer-motion";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  BellRing,
  ChartPie,
  FilePenLine,
  Files,
  FolderSearch,
  MessageSquareText,
  Scale,
  Upload,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { ROUTES } from "../../utils/constants";
import { formatDate, formatRelativeDate } from "../../utils/helpers";
import authApi from "../../api/authApi";
import dashboardApi from "../../api/dashboardApi";
import { clearTokens } from "../../utils/tokenStorage";
import {
  markAllNotificationsRead,
} from "../../services/notificationsService";
import logger from "../../utils/logger";
import AtlasButton from "../../components/common/AtlasButton";
import { useNavigate } from "react-router-dom";
import GlowingEffectCard from "../../components/ui/GlowingEffectCard";

const panelSx = (theme) => ({
  borderRadius: "14px",
  border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.12)}`,
  background: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.97 : 0.99),
  boxShadow: `0 20px 38px ${alpha(
    theme.palette.common.black,
    theme.palette.mode === "dark" ? 0.22 : 0.08
  )}`,
  position: "relative",
  overflow: "hidden",
  "&::after": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    background: alpha(theme.palette.primary.main, 0.22),
  },
});

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function truncateText(value, maxLength = 42) {
  if (!value) return "Untitled";
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function niceFileName(value) {
  if (!value) return "Untitled document";
  return value.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

const EMPTY_DASHBOARD_OVERVIEW = Object.freeze({
  stats: {
    total_documents: 0,
    ocr_ready_documents: 0,
    tracked_citations: 0,
    saved_drafts: 0,
    attention_needed: 0,
    documents_this_week: 0,
    pending_documents: 0,
    documents_with_citations: 0,
    sampled_documents: 0,
  },
  recent_activity: [],
  queue_items: [],
  analytics: {
    workload_split: [],
    uploads_last_7_days: [0, 0, 0, 0, 0, 0, 0],
    usage_rows: [],
  },
  notifications: {
    items: [],
    unread_count: 0,
    derived: false,
  },
  snapshot: {
    latest_document: null,
    latest_draft: null,
  },
});

function normalizeDashboardOverview(raw) {
  const stats = raw?.stats || {};
  const analytics = raw?.analytics || {};
  const notifications = raw?.notifications || {};
  const snapshot = raw?.snapshot || {};

  return {
    stats: {
      total_documents: Number(stats.total_documents) || 0,
      ocr_ready_documents: Number(stats.ocr_ready_documents) || 0,
      tracked_citations: Number(stats.tracked_citations) || 0,
      saved_drafts: Number(stats.saved_drafts) || 0,
      attention_needed: Number(stats.attention_needed) || 0,
      documents_this_week: Number(stats.documents_this_week) || 0,
      pending_documents: Number(stats.pending_documents) || 0,
      documents_with_citations: Number(stats.documents_with_citations) || 0,
      sampled_documents: Number(stats.sampled_documents) || 0,
    },
    recent_activity: Array.isArray(raw?.recent_activity) ? raw.recent_activity : [],
    queue_items: Array.isArray(raw?.queue_items) ? raw.queue_items : [],
    analytics: {
      workload_split: Array.isArray(analytics.workload_split) ? analytics.workload_split : [],
      uploads_last_7_days: Array.isArray(analytics.uploads_last_7_days)
        ? analytics.uploads_last_7_days
        : EMPTY_DASHBOARD_OVERVIEW.analytics.uploads_last_7_days,
      usage_rows: Array.isArray(analytics.usage_rows) ? analytics.usage_rows : [],
    },
    notifications: {
      items: Array.isArray(notifications.items) ? notifications.items : [],
      unread_count: Number(notifications.unread_count) || 0,
      derived: Boolean(notifications.derived),
    },
    snapshot: {
      latest_document: snapshot.latest_document || null,
      latest_draft: snapshot.latest_draft || null,
    },
  };
}

function getActivityIcon(type) {
  if (type === "draft.updated") return <EditNoteOutlinedIcon />;
  if (type === "ocr.completed") return <FactCheckOutlinedIcon />;
  if (type === "document.uploaded") return <UploadFileRoundedIcon />;
  return <DescriptionOutlinedIcon />;
}

function getActivityBadge(type, status) {
  if (type === "draft.updated" || status === "draft") {
    return { label: "Draft", tone: "accent" };
  }
  if (type === "ocr.completed" || status === "verified") {
    return { label: "Verified", tone: "success" };
  }
  if (type === "document.uploaded" || status === "processing") {
    return { label: "Processing", tone: "warning" };
  }
  return { label: "Live", tone: "default" };
}

function getQueueIcon(type, severity) {
  if (type === "documents.ocr_pending") return <HourglassBottomRoundedIcon />;
  if (type === "citations.pending") return <GavelRoundedIcon />;
  if (type === "queue.clear" || severity === "success") return <AutoAwesomeOutlinedIcon />;
  return <WarningAmberRoundedIcon />;
}

function getQueueBadge(severity) {
  if (severity === "error") return { label: "Flagged", tone: "error" };
  if (severity === "warning") return { label: "Needs review", tone: "warning" };
  if (severity === "success") return { label: "Clear", tone: "success" };
  return { label: "Queue", tone: "default" };
}

function StatusBadge({ label, tone = "default" }) {
  const theme = useTheme();
  const tones = {
    success: {
      color: theme.palette.success.main,
      background: alpha(theme.palette.success.main, 0.14),
      border: alpha(theme.palette.success.main, 0.18),
    },
    warning: {
      color: theme.palette.warning.main,
      background: alpha(theme.palette.warning.main, 0.14),
      border: alpha(theme.palette.warning.main, 0.18),
    },
    error: {
      color: theme.palette.error.main,
      background: alpha(theme.palette.error.main, 0.14),
      border: alpha(theme.palette.error.main, 0.2),
    },
    accent: {
      color: theme.palette.primary.main,
      background: alpha(theme.palette.primary.main, 0.12),
      border: alpha(theme.palette.primary.main, 0.18),
    },
    default: {
      color: theme.palette.text.secondary,
      background: alpha(theme.palette.text.secondary, 0.08),
      border: alpha(theme.palette.text.secondary, 0.12),
    },
  };
  const selected = tones[tone] || tones.default;

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 24,
        borderRadius: "999px",
        color: selected.color,
        bgcolor: selected.background,
        border: `1px solid ${selected.border}`,
        fontWeight: 700,
        fontSize: "0.68rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        "& .MuiChip-label": {
          px: 1,
        },
      }}
    />
  );
}

function Panel({ kicker, title, action, children, sx }) {
  const theme = useTheme();
  return (
    <Box sx={{ ...panelSx(theme), ...sx }}>
      <Box sx={{ position: "relative", zIndex: 1 }}>
        {(kicker || title || action) && (
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 2,
              px: { xs: 2, md: 2.4 },
              pt: { xs: 2, md: 2.25 },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              {kicker && (
                <Typography
                  sx={{
                    color: "text.secondary",
                    fontSize: "0.64rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    mb: 0.35,
                    fontWeight: 600,
                  }}
                >
                  {kicker}
                </Typography>
              )}
              {title && (
                <Typography
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: { xs: "1.35rem", md: "1.55rem" },
                    lineHeight: 1,
                    color: "text.primary",
                  }}
                >
                  {title}
                </Typography>
              )}
            </Box>
            {action}
          </Box>
        )}
        <Box sx={{ px: { xs: 2, md: 2.4 }, pb: { xs: 2, md: 2.3 }, pt: title || kicker ? 1.5 : 2.2 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

function StatTile({ label, value, title, description, tone = "primary", icon, badge }) {
  return (
    <GlowingEffectCard
      eyebrow={label}
      value={value}
      title={title}
      description={description}
      tone={tone}
      icon={icon}
      badge={badge}
      minHeight={210}
    />
  );
}

function TimelineRow({ icon, title, copy, badge, meta, onClick }) {
  const theme = useTheme();
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        gap: 1.25,
        alignItems: "start",
        p: 1.45,
        borderRadius: "12px",
        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.22 : 0.7),
        transition: "transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease",
        cursor: onClick ? "pointer" : "default",
        "&:hover": onClick
          ? {
              transform: "translateY(-1px)",
              borderColor: alpha(theme.palette.primary.main, 0.22),
              bgcolor: alpha(theme.palette.primary.main, 0.06),
            }
          : undefined,
      }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
          color: "primary.main",
          flexShrink: 0,
          "& svg": {
            fontSize: 18,
          },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: "text.primary", fontWeight: 600, fontSize: "0.92rem", mb: 0.35 }}>
          {title}
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: "0.8rem", lineHeight: 1.62 }}>
          {copy}
        </Typography>
      </Box>
      <Box sx={{ display: "grid", justifyItems: "end", gap: 0.65, minWidth: { xs: 72, sm: 88 } }}>
        {badge}
        <Typography sx={{ color: "text.secondary", fontSize: "0.72rem", whiteSpace: "nowrap" }}>
          {meta}
        </Typography>
      </Box>
    </Box>
  );
}

function DonutCard({ title, total, segments }) {
  const theme = useTheme();
  const safeTotal = total || 1;
  const percentages = segments.map((segment) => ({
    ...segment,
    ratio: clampPercent(Math.round((segment.value / safeTotal) * 100)),
  }));
  const gradient = percentages
    .reduce(
      (acc, segment) => {
        const start = acc.offset;
        const end = start + (segment.value / safeTotal) * 100;
        acc.parts.push(`${segment.color} ${start}% ${end}%`);
        acc.offset = end;
        return acc;
      },
      { parts: [], offset: 0 }
    )
    .parts.join(", ");

  return (
    <GlowingEffectCard
      icon={<ChartPie size={18} strokeWidth={1.8} />}
      title={title}
      description={`${total} active records currently visible in the backend-derived workload split.`}
      badge="Overview"
      tone="primary"
      minHeight={330}
    >
      <Box sx={{ display: "grid", placeItems: "center", py: 0.65 }}>
        <Box
          sx={{
            width: 148,
            height: 148,
            borderRadius: "50%",
            background: `conic-gradient(${gradient || `${alpha(theme.palette.primary.main, 0.22)} 0% 100%`})`,
            display: "grid",
            placeItems: "center",
            boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.14)}`,
          }}
        >
          <Box
            sx={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: "background.paper",
              boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.18 : 0.08)}`,
            }}
          >
            <Typography
              sx={{
                fontFamily: "var(--font-display)",
                fontSize: "1.75rem",
                lineHeight: 1,
                color: "text.primary",
              }}
            >
              {percentages[0]?.ratio || 0}%
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.72rem", mt: 0.15 }}>
              {percentages[0]?.label || "Ready"}
            </Typography>
          </Box>
        </Box>
      </Box>
      <Stack spacing={1.05} sx={{ mt: 1.6 }}>
        {percentages.map((segment) => (
          <Stack key={segment.label} direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: segment.color,
                }}
              />
              <Typography sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                {segment.label}
              </Typography>
            </Stack>
            <Typography sx={{ color: "text.primary", fontWeight: 700, fontSize: "0.8rem" }}>
              {segment.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </GlowingEffectCard>
  );
}

function TrendBars({ values }) {
  const theme = useTheme();
  const maxValue = Math.max(...values, 1);

  return (
    <GlowingEffectCard
      icon={<BarChart3 size={18} strokeWidth={1.8} />}
      title="Weekly throughput"
      description="Upload flow over the last 7 days, based on the dashboard overview feed."
      badge="7-day trend"
      tone="success"
      minHeight={330}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", alignItems: "end", gap: 1, height: 136, mt: 0.8 }}>
        {values.map((value, index) => (
          <Box key={index} sx={{ display: "grid", gap: 0.6 }}>
            <Box
              sx={{
                height: `${Math.max(18, (value / maxValue) * 100)}%`,
                minHeight: 18,
                borderRadius: "10px 10px 4px 4px",
                background: `linear-gradient(180deg, ${alpha(theme.palette.primary.light || theme.palette.primary.main, 0.94)} 0%, ${alpha(
                  theme.palette.primary.main,
                  0.72
                )} 100%)`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
              }}
            />
            <Typography sx={{ color: "text.secondary", fontSize: "0.7rem", textAlign: "center" }}>
              {["M", "T", "W", "T", "F", "S", "S"][index]}
            </Typography>
          </Box>
        ))}
      </Box>
    </GlowingEffectCard>
  );
}

function UsageRows({ rows }) {
  const theme = useTheme();
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <GlowingEffectCard
      icon={<FolderSearch size={18} strokeWidth={1.8} />}
      title="Workspace signals"
      description="Compact comparisons returned directly from the backend overview."
      badge="Compact compare"
      tone="neutral"
      minHeight={278}
    >
      <Stack spacing={1.25} sx={{ mt: 0.8 }}>
        {rows.map((row) => (
          <Box key={row.label}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
              <Typography sx={{ color: "text.secondary", fontSize: "0.8rem" }}>{row.label}</Typography>
              <Typography sx={{ color: "text.primary", fontWeight: 700, fontSize: "0.8rem" }}>
                {row.value} {row.unit}
              </Typography>
            </Stack>
            <Box
              sx={{
                height: 8,
                borderRadius: "999px",
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  width: `${clampPercent((row.value / maxValue) * 100)}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background: `linear-gradient(90deg, ${alpha(
                    theme.palette.primary.main,
                    0.84
                  )} 0%, ${alpha(theme.palette.primary.light || theme.palette.primary.main, 0.92)} 100%)`,
                }}
              />
            </Box>
          </Box>
        ))}
      </Stack>
    </GlowingEffectCard>
  );
}

function QuickActionCard({ title, copy, icon, onClick, primary = false, tone = "primary", badge }) {
  return (
    <GlowingEffectCard
      icon={icon}
      title={title}
      description={copy}
      tone={primary ? "primary" : tone}
      badge={badge}
      onClick={onClick}
      minHeight={228}
      sx={{
        height: "100%",
      }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <Box sx={{ display: "grid", gap: 2.2 }}>
      <Skeleton variant="rounded" height={248} sx={{ borderRadius: 3 }} />
      <Skeleton variant="rounded" height={340} sx={{ borderRadius: 3 }} />
      <Skeleton variant="rounded" height={420} sx={{ borderRadius: 3 }} />
    </Box>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMountedRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(EMPTY_DASHBOARD_OVERVIEW);
  const [notifications, setNotifications] = useState([]);
  const [notificationsDerived, setNotificationsDerived] = useState(false);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [profileAnchor, setProfileAnchor] = useState(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    try {
      const response = await dashboardApi.getOverview();

      if (!isMountedRef.current) return;

      const nextOverview = normalizeDashboardOverview(response);
      setOverview(nextOverview);
      setNotifications(nextOverview.notifications.items);
      setNotificationsDerived(nextOverview.notifications.derived);
    } catch (error) {
      logger.error("[Dashboard] Failed to load dashboard data", error);
      if (!isMountedRef.current) return;

      setOverview(EMPTY_DASHBOARD_OVERVIEW);
      setNotifications([]);
      setNotificationsDerived(false);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const stats = overview.stats;
  const recentDraft = overview.snapshot.latest_draft || null;
  const latestDocument = overview.snapshot.latest_document || null;
  const attentionNeeded = stats.attention_needed || 0;

  const statTiles = useMemo(() => {
    const sampledCitationSuffix = stats.sampled_documents
      ? `${stats.sampled_documents} OCR-ready file${stats.sampled_documents === 1 ? "" : "s"} sampled`
      : "No citation data sampled yet";

    return [
      {
        label: "Documents",
        value: stats.total_documents,
        title: "Matter files in the workspace",
        description: `${stats.documents_this_week} added in the last 7 days`,
        tone: stats.documents_this_week > 0 ? "success" : "neutral",
        icon: <Files size={18} strokeWidth={1.8} />,
        badge: stats.documents_this_week > 0 ? "Active" : "Quiet",
      },
      {
        label: "Tracked Citations",
        value: stats.tracked_citations,
        title: "References surfaced from sampled OCR-ready files",
        description: sampledCitationSuffix,
        tone: stats.tracked_citations > 0 ? "primary" : "neutral",
        icon: <BadgeCheck size={18} strokeWidth={1.8} />,
        badge: stats.tracked_citations > 0 ? "Verified" : "Pending",
      },
      {
        label: "Drafts Generated",
        value: stats.saved_drafts,
        title: "Saved drafting sessions in motion",
        description: recentDraft
          ? `Last updated ${formatRelativeDate(recentDraft.updated_at)}`
          : "No saved drafts yet",
        tone: recentDraft ? "primary" : "warning",
        icon: <FilePenLine size={18} strokeWidth={1.8} />,
        badge: recentDraft ? "In progress" : "Empty",
      },
      {
        label: "Attention Needed",
        value: String(attentionNeeded).padStart(2, "0"),
        title: "Items that still need a manual pass",
        description:
          attentionNeeded > 0
            ? `${stats.pending_documents} OCR item${stats.pending_documents === 1 ? "" : "s"} still pending`
            : "Workspace queue looks clear",
        tone: attentionNeeded > 0 ? "warning" : "success",
        icon: <AlertTriangle size={18} strokeWidth={1.8} />,
        badge: attentionNeeded > 0 ? "Review" : "Clear",
      },
    ];
  }, [
    attentionNeeded,
    recentDraft,
    stats.documents_this_week,
    stats.pending_documents,
    stats.sampled_documents,
    stats.saved_drafts,
    stats.total_documents,
    stats.tracked_citations,
  ]);

  const activityItems = useMemo(() => {
    const mapped = overview.recent_activity.map((item, index) => {
      const badge = getActivityBadge(item?.type, item?.status);
      return {
        key: item?.id || `activity-${index}`,
        icon: getActivityIcon(item?.type),
        title: truncateText(item?.title || "Recent activity", 42),
        copy: item?.copy || "Recent workspace activity is available.",
        badge: <StatusBadge label={badge.label} tone={badge.tone} />,
        meta: item?.created_at ? formatRelativeDate(item.created_at) : "Now",
        onClick: item?.route ? () => navigate(item.route) : undefined,
      };
    });

    return mapped.length > 0
      ? mapped.slice(0, 3)
      : [
          {
            key: "activity-empty",
            icon: <DescriptionOutlinedIcon />,
            title: "No recent activity is available yet",
            copy: "New document, OCR, and drafting events will appear here as the workspace warms up.",
            badge: <StatusBadge label="Waiting" tone="default" />,
            meta: "Live",
          },
        ];
  }, [navigate, overview.recent_activity]);

  const queueItems = useMemo(() => {
    const mapped = overview.queue_items.map((item, index) => {
      const badge = getQueueBadge(item?.severity);
      return {
        key: item?.id || `queue-${index}`,
        icon: getQueueIcon(item?.type, item?.severity),
        title: item?.title || "Queue item",
        copy: item?.copy || "This item needs attention.",
        badge: <StatusBadge label={badge.label} tone={badge.tone} />,
        meta: "Queue",
        onClick: item?.route ? () => navigate(item.route) : undefined,
      };
    });

    return mapped.length > 0
      ? mapped
      : [
          {
            key: "queue-clear",
            icon: <AutoAwesomeOutlinedIcon />,
            title: "No urgent blockers are visible from the current backend data",
            copy: "The workspace looks stable across documents, drafts, and sampled citation coverage.",
            badge: <StatusBadge label="Clear" tone="success" />,
            meta: "Queue",
          },
        ];
  }, [navigate, overview.queue_items]);

  const workloadSegments = useMemo(() => {
    const colorMap = {
      Verified: theme.palette.success.main,
      Processing: theme.palette.primary.main,
      Flagged: theme.palette.error.main,
    };

    return (overview.analytics.workload_split || []).map((segment) => ({
      label: segment?.label || "Segment",
      value: Number(segment?.value) || 0,
      color: colorMap[segment?.label] || theme.palette.text.secondary,
    }));
  }, [
    overview.analytics.workload_split,
    theme.palette.error.main,
    theme.palette.primary.main,
    theme.palette.success.main,
    theme.palette.text.secondary,
  ]);

  const weeklyBars = useMemo(
    () =>
      Array.isArray(overview.analytics.uploads_last_7_days)
        ? overview.analytics.uploads_last_7_days.map((value) => Number(value) || 0)
        : EMPTY_DASHBOARD_OVERVIEW.analytics.uploads_last_7_days,
    [overview.analytics.uploads_last_7_days]
  );

  const usageRows = useMemo(
    () =>
      (overview.analytics.usage_rows || []).map((row) => ({
        label: row?.label || "Metric",
        value: Number(row?.value) || 0,
        unit: row?.unit || "",
      })),
    [overview.analytics.usage_rows]
  );

  const quickActions = useMemo(
    () => [
      {
        title: "Upload a new case file",
        copy: "Start ingestion for PDF, DOCX, or scanned image material.",
        icon: <Upload size={18} strokeWidth={1.8} />,
        onClick: () => navigate(ROUTES.DOCUMENT_UPLOAD),
        primary: true,
        badge: "Start",
      },
      {
        title: recentDraft ? "Continue last draft" : "Open drafting assistant",
        copy: recentDraft
          ? `Jump back into ${truncateText(recentDraft.title || "your latest draft", 28)}.`
          : "Open the drafting workspace and begin a new document flow.",
        icon: <FilePenLine size={18} strokeWidth={1.8} />,
        onClick: () => navigate(ROUTES.DRAFTING_ASSISTANT),
        tone: "primary",
        badge: recentDraft ? "Resume" : "Draft",
      },
      {
        title: "Run citation verification",
        copy: "Open the document library and inspect extracted references before drafting.",
        icon: <Scale size={18} strokeWidth={1.8} />,
        onClick: () => navigate(ROUTES.DOCUMENTS),
        tone: "success",
        badge: "Check",
      },
      {
        title: "Launch legal assistant",
        copy: "Move into chat-driven legal support and research from the same workspace.",
        icon: <MessageSquareText size={18} strokeWidth={1.8} />,
        onClick: () => navigate(ROUTES.CHAT),
        tone: "neutral",
        badge: "Chat",
      },
    ],
    [navigate, recentDraft]
  );

  const openNotifMenu = (event) => setNotifAnchor(event.currentTarget);
  const closeNotifMenu = () => setNotifAnchor(null);
  const markAllRead = () =>
    setNotifications((current) => markAllNotificationsRead(current));

  const openProfileMenu = (event) => setProfileAnchor(event.currentTarget);
  const closeProfileMenu = () => setProfileAnchor(null);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      logger.error("[Dashboard] Logout API call failed", error);
    } finally {
      clearTokens();
      navigate(ROUTES.LOGIN, { replace: true });
    }
  };

  return (
    <DashboardLayout
      topbarProps={{
        notifications,
        unreadCount,
        notifAnchor,
        openNotifMenu,
        closeNotifMenu,
        markAllRead,
        profileAnchor,
        openProfileMenu,
        closeProfileMenu,
        onProfile: () => {
          closeProfileMenu();
          navigate(ROUTES.SETTINGS);
        },
        onAccount: () => {
          closeProfileMenu();
          navigate(ROUTES.DASHBOARD);
        },
        onLogout: () => {
          closeProfileMenu();
          handleLogout();
        },
        onViewAllNotifications: () => {
          closeNotifMenu();
          navigate("/dashboard/notifications");
        },
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: "1440px",
          mx: "auto",
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 2.5, md: 3.4 },
          minHeight: "calc(100vh - var(--adal-topbar-offset, 64px))",
          position: "relative",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(${alpha(theme.palette.primary.main, 0.035)} 1px, transparent 1px),
              linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.035)} 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
            pointerEvents: "none",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            right: { xs: "-140px", md: "-60px" },
            bottom: { xs: "-180px", md: "-140px" },
            width: { xs: 320, md: 480 },
            height: { xs: 320, md: 480 },
            borderRadius: "50%",
            background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 72%)`,
            pointerEvents: "none",
          },
        }}
      >
        <Box sx={{ position: "relative", zIndex: 1 }}>
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <Box sx={{ display: "grid", gap: 2 }}>
              <Motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.36 }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "1.25fr 0.95fr" },
                    gap: 2,
                  }}
                >
                  <Box sx={panelSx(theme)}>
                    <Box sx={{ position: "relative", zIndex: 1, p: { xs: 2.2, md: 2.6 } }}>
                      <Typography
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.64rem",
                          letterSpacing: "0.22em",
                          textTransform: "uppercase",
                          fontWeight: 600,
                          mb: 0.9,
                        }}
                      >
                        Today at a glance
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: "var(--font-display)",
                          fontSize: { xs: "2.2rem", md: "3.05rem" },
                          lineHeight: 0.98,
                          color: "text.primary",
                          maxWidth: "13ch",
                          mb: 1.15,
                        }}
                      >
                        Legal work should feel{" "}
                        <Box component="span" sx={{ color: "primary.main" }}>
                          directed
                        </Box>
                        , not scattered.
                      </Typography>
                      <Typography
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.92rem",
                          lineHeight: 1.72,
                          maxWidth: "60ch",
                        }}
                      >
                        The dashboard now surfaces what the backend is actively tracking first:
                        document processing, saved draft momentum, sampled citation coverage, and the next
                        routes your team is most likely to take.
                      </Typography>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1} sx={{ mt: 2.1 }}>
                        <AtlasButton
                          onClick={() =>
                            navigate(recentDraft ? ROUTES.DRAFTING_ASSISTANT : ROUTES.DOCUMENT_UPLOAD)
                          }
                          startIcon={recentDraft ? <EditNoteOutlinedIcon /> : <UploadFileRoundedIcon />}
                          sx={{
                            px: 2.1,
                            py: 1.05,
                            borderRadius: "10px",
                            bgcolor: "primary.main",
                            boxShadow: `0 10px 22px ${alpha(theme.palette.primary.main, 0.24)}`,
                          }}
                        >
                          {recentDraft ? "Continue Last Draft" : "Upload Document"}
                        </AtlasButton>
                        <AtlasButton
                          variant="outlined"
                          onClick={() => navigate(ROUTES.DOCUMENTS)}
                          startIcon={<GavelRoundedIcon />}
                          sx={{
                            px: 2.1,
                            py: 1.05,
                            borderRadius: "10px",
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                          }}
                        >
                          Review Flagged Items
                        </AtlasButton>
                        <AtlasButton
                          variant="outlined"
                          onClick={() => navigate(ROUTES.CHAT)}
                          startIcon={<ChatBubbleOutlineRoundedIcon />}
                          sx={{
                            px: 2.1,
                            py: 1.05,
                            borderRadius: "10px",
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                          }}
                        >
                          Open Chat
                        </AtlasButton>
                      </Stack>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 1.2,
                      alignContent: "start",
                    }}
                  >
                    {statTiles.map((tile) => (
                      <StatTile key={tile.label} {...tile} />
                    ))}
                  </Box>
                </Box>
              </Motion.div>

              <Motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.08 }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "1.08fr 0.92fr" },
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: "grid", gap: 2 }}>
                    <Panel
                      kicker="Recent Activity"
                      title="Continue where the work moved"
                      action={
                        <Typography
                          component="button"
                          onClick={() => navigate(ROUTES.DOCUMENTS)}
                          sx={{
                            border: 0,
                            p: 0,
                            bgcolor: "transparent",
                            color: "primary.main",
                            fontSize: "0.72rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.14em",
                            cursor: "pointer",
                          }}
                        >
                          View all
                        </Typography>
                      }
                    >
                      <Stack spacing={1}>
                        {activityItems.map((item) => (
                          <TimelineRow key={item.key} {...item} />
                        ))}
                      </Stack>
                    </Panel>

                    <Panel
                      kicker="Work Queue"
                      title="Items that need attention"
                      action={
                        <Typography
                          component="button"
                          onClick={() => navigate(ROUTES.DOCUMENTS)}
                          sx={{
                            border: 0,
                            p: 0,
                            bgcolor: "transparent",
                            color: "primary.main",
                            fontSize: "0.72rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.14em",
                            cursor: "pointer",
                          }}
                        >
                          Open queue
                        </Typography>
                      }
                    >
                      <Stack spacing={1}>
                        {queueItems.map((item) => (
                          <TimelineRow key={item.key} {...item} />
                        ))}
                      </Stack>
                    </Panel>
                  </Box>

                  <Box sx={{ display: "grid", gap: 2 }}>
                    <Panel kicker="Light Analytics" title="Fast operational read">
                      <Box sx={{ display: "grid", gap: 1.4 }}>
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                            gap: 1.4,
                          }}
                        >
                          <DonutCard
                            title="Workload split"
                            total={sum(workloadSegments.map((segment) => segment.value))}
                            segments={workloadSegments}
                          />
                          <TrendBars values={weeklyBars} />
                        </Box>
                        <UsageRows rows={usageRows} />
                      </Box>
                    </Panel>

                    <Panel kicker="Quick Actions" title="Fast routes into work">
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                          gap: 1.25,
                        }}
                      >
                        {quickActions.map((action) => (
                          <QuickActionCard key={action.title} {...action} />
                        ))}
                      </Box>
                    </Panel>
                  </Box>
                </Box>
              </Motion.div>

              <Motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.14 }}
              >
                <Panel kicker="Workspace Snapshot" title="Current workspace records">
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
                      gap: 1.2,
                    }}
                  >
                    <QuickActionCard
                      title="Recent documents"
                      copy={
                        latestDocument
                          ? `${truncateText(niceFileName(latestDocument.filename), 28)} uploaded ${formatRelativeDate(latestDocument.created_at)}.`
                          : "No uploaded documents are available yet."
                      }
                      icon={<Files size={18} strokeWidth={1.8} />}
                      tone="primary"
                      badge="Files"
                      onClick={() => navigate(ROUTES.DOCUMENTS)}
                    />
                    <QuickActionCard
                      title="Citation coverage"
                      copy={
                        stats.sampled_documents
                          ? `${stats.documents_with_citations} of ${stats.sampled_documents} sampled OCR-ready documents already expose citations.`
                          : "Citation extraction has not produced dashboard-visible data yet."
                      }
                      icon={<BadgeCheck size={18} strokeWidth={1.8} />}
                      tone="success"
                      badge="Coverage"
                      onClick={() => navigate(ROUTES.DOCUMENTS)}
                    />
                    <QuickActionCard
                      title="Draft history"
                      copy={
                        recentDraft
                          ? `${truncateText(recentDraft.title || "Latest draft", 28)} updated on ${formatDate(recentDraft.updated_at)}.`
                          : "No saved drafts are available yet."
                      }
                      icon={<FilePenLine size={18} strokeWidth={1.8} />}
                      tone="primary"
                      badge="Drafts"
                      onClick={() => navigate(ROUTES.DRAFTING_ASSISTANT)}
                    />
                    <QuickActionCard
                      title="Notification state"
                      copy={
                        notificationsDerived
                          ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} currently derived from recent workspace events.`
                          : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} currently visible.`
                      }
                      icon={<BellRing size={18} strokeWidth={1.8} />}
                      tone={notificationsDerived ? "primary" : "neutral"}
                      badge={notificationsDerived ? "Derived" : "Live"}
                      onClick={() => navigate("/dashboard/notifications")}
                    />
                  </Box>
                </Panel>
              </Motion.div>
            </Box>
          )}
        </Box>
      </Box>
    </DashboardLayout>
  );
}
