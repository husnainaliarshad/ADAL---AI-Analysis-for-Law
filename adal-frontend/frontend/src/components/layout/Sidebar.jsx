import React, { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Box, Drawer, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import { AnimatePresence, motion as Motion } from "framer-motion";
import AdalLogo from "../ui/AdalLogo";
import CaseSelector from "../common/CaseSelector";
import { ROUTES, STORAGE_KEYS, UI } from "../../utils/constants";

const DRAWER_WIDTH = UI.DRAWER_WIDTH;
const COLLAPSED_WIDTH = 64;

const navSections = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", to: ROUTES.DASHBOARD, icon: <DashboardOutlinedIcon /> },
      { label: "Documents", to: ROUTES.DOCUMENTS, icon: <DescriptionOutlinedIcon /> },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { label: "Legal Assistant", to: ROUTES.CHAT, icon: <ChatBubbleOutlineRoundedIcon /> },
      { label: "Draft Generator", to: ROUTES.DRAFTING_ASSISTANT, icon: <EditNoteOutlinedIcon /> },
    ],
  },
];

const sidebarShellSx = {
  position: "relative",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  backgroundColor: "var(--surface-deep)",
  borderRight: "1px solid var(--border)",
  color: "var(--text-primary)",
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    backgroundImage: `
      linear-gradient(var(--grid-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)
    `,
    backgroundSize: "32px 32px",
    pointerEvents: "none",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "1.5px",
    background: "linear-gradient(90deg, var(--violet) 0%, transparent 100%)",
    pointerEvents: "none",
  },
};

const navItemSx = (collapsed, isDanger = false) => ({
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: collapsed ? 0 : "0.75rem",
  width: "100%",
  minHeight: 48,
  padding: collapsed ? "0.6rem 0.55rem" : "0.62rem 1.1rem",
  border: 0,
  borderRadius: 0,
  background: "transparent",
  color: isDanger ? "var(--error)" : "var(--text-secondary)",
  textDecoration: "none",
  cursor: "pointer",
  overflow: "hidden",
  whiteSpace: "nowrap",
  justifyContent: collapsed ? "center" : "flex-start",
  transition: "background 0.15s ease, color 0.15s ease",
  "&::before": {
    content: '""',
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "2px",
    background: isDanger ? "var(--error)" : "var(--violet)",
    transform: "scaleY(0)",
    transformOrigin: "center",
    transition: "transform 0.2s ease",
  },
  "&:hover": {
    background: isDanger ? "rgba(226, 75, 74, 0.08)" : "rgba(127, 119, 221, 0.06)",
    color: isDanger ? "var(--error)" : "var(--lavender)",
    textDecoration: "none",
  },
  "&.active": {
    background: "rgba(127, 119, 221, 0.1)",
    color: "var(--text-primary)",
  },
  "&.active::before": {
    transform: "scaleY(1)",
  },
});

const SidebarBadge = ({ children, collapsed, tone = "default" }) => {
  if (collapsed) return null;
  const isAccent = tone === "accent";
  return (
    <Box sx={{
      ml: "auto", minWidth: isAccent ? "auto" : 18, height: 18,
      px: isAccent ? "5px" : "5px",
      borderRadius: isAccent ? "2px" : "999px",
      backgroundColor: isAccent ? "transparent" : "var(--violet-deep)",
      border: isAccent ? "1px solid var(--border-bright)" : "none",
      color: isAccent ? "var(--violet)" : "var(--fog)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, fontSize: isAccent ? "0.58rem" : "0.62rem",
      fontWeight: 500, letterSpacing: isAccent ? "0.1em" : 0,
      textTransform: isAccent ? "uppercase" : "none",
    }}>
      {children}
    </Box>
  );
};

const SidebarItem = ({ item, collapsed, onNavigate }) => {
  const label = (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <Motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
          exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.16 }}
          style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
          <Typography component="span" sx={{ fontSize: "0.82rem", fontWeight: 400, lineHeight: 1.2,
            color: "inherit", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.label}
          </Typography>
        </Motion.div>
      )}
    </AnimatePresence>
  );

  const content = (
    <>
      <Box sx={{ width: 36, height: 36, borderRadius: "6px", display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0, backgroundColor: "transparent",
        transition: "background 0.15s ease",
        ".sidebar-item:hover &, .sidebar-item.active &": {
          backgroundColor: item.isDanger ? "rgba(226, 75, 74, 0.12)" : "rgba(127, 119, 221, 0.12)",
        },
        "& svg": { fontSize: 18 },
      }}>
        {item.icon}
      </Box>
      {label}
      {item.badge && (
        <SidebarBadge collapsed={collapsed} tone={item.badge === "New" ? "accent" : "default"}>
          {item.badge}
        </SidebarBadge>
      )}
    </>
  );

  const tooltipProps = {
    title: collapsed ? item.label : "",
    placement: "right",
    disableHoverListener: !collapsed,
    disableFocusListener: !collapsed,
    disableTouchListener: !collapsed,
  };

  if (item.to) {
    return (
      <Tooltip {...tooltipProps}>
        <Box component={NavLink} to={item.to} onClick={onNavigate}
          className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}
          sx={navItemSx(collapsed, item.isDanger)}>
          {content}
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip {...tooltipProps}>
      <Box component="button" type="button" onClick={item.onClick} className="sidebar-item"
        sx={navItemSx(collapsed, item.isDanger)}>
        {content}
      </Box>
    </Tooltip>
  );
};

const SidebarSection = ({ section, collapsed, onNavigate }) => (
  <Box sx={{ mb: "0.25rem" }}>
    <AnimatePresence initial={false}>
      {!collapsed && (
        <Motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.16 }}>
          <Typography sx={{ px: "1.1rem", pt: "0.6rem", pb: "0.3rem", color: "var(--text-muted)",
            fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase" }}>
            {section.label}
          </Typography>
        </Motion.div>
      )}
    </AnimatePresence>
    <Box>
      {section.items.map((item) => (
        <SidebarItem key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
      ))}
    </Box>
  </Box>
);

const SidebarLogo = ({ collapsed }) => (
  <Box component={NavLink} to={ROUTES.ROOT} sx={{ display: "flex", alignItems: "center",
    gap: collapsed ? 0 : "0.75rem", justifyContent: collapsed ? "center" : "flex-start",
    px: collapsed ? "0.75rem" : "1.1rem", height: 56, textDecoration: "none", color: "inherit",
    overflow: "hidden", whiteSpace: "nowrap", position: "relative", zIndex: 1 }}>
    <Box sx={{ width: 32, height: 32, borderRadius: "6px", backgroundColor: "var(--violet-deep)",
      border: "1px solid var(--border-bright)", display: "flex", alignItems: "center",
      justifyContent: "center", p: "5px", flexShrink: 0 }}>
      <AdalLogo variant="icon" height={22} />
    </Box>
    <AnimatePresence initial={false}>
      {!collapsed && (
        <Motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.16 }}
          style={{ minWidth: 0, overflow: "hidden", display: "grid", gap: "0.28rem" }}>
          <AdalLogo variant="full" height={20} sx={{ width: "92px", maxWidth: "100%" }} />
          <Typography sx={{ color: "var(--text-muted)", fontSize: "0.58rem",
            textTransform: "uppercase", letterSpacing: "0.12em" }}>
            AI Analysis for Law
          </Typography>
        </Motion.div>
      )}
    </AnimatePresence>
  </Box>
);

const SidebarCollapseControl = ({ collapsed, onToggleCollapse }) => (
  <Box sx={{ px: collapsed ? "0.75rem" : "1.1rem", py: "0.55rem",
    borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center",
    justifyContent: collapsed ? "center" : "flex-end", position: "relative", zIndex: 1 }}>
    <Box component="button" type="button" onClick={onToggleCollapse}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      sx={{ minWidth: collapsed ? 30 : 112, height: 30, borderRadius: "8px",
        border: "1px solid var(--border-bright)",
        background: "linear-gradient(180deg, rgba(127, 119, 221, 0.12) 0%, rgba(127, 119, 221, 0.06) 100%)",
        color: "var(--lavender)", display: "flex", alignItems: "center", justifyContent: "center",
        gap: collapsed ? 0 : "0.45rem", padding: collapsed ? 0 : "0 0.65rem",
        cursor: "pointer", boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        transition: "background 0.2s ease, color 0.2s ease, transform 0.2s ease, border-color 0.2s ease",
        "&:hover": {
          background: "linear-gradient(180deg, rgba(127, 119, 221, 0.2) 0%, rgba(127, 119, 221, 0.12) 100%)",
          color: "var(--fog)", borderColor: "var(--violet)", transform: "translateY(-1px)",
        },
      }}>
      {collapsed ? (
        <KeyboardDoubleArrowRightIcon sx={{ fontSize: 18 }} />
      ) : (
        <>
          <KeyboardDoubleArrowLeftIcon sx={{ fontSize: 18, flexShrink: 0 }} />
          <Typography component="span" sx={{ fontSize: "0.68rem", fontWeight: 600,
            letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1, color: "inherit" }}>
            Collapse
          </Typography>
        </>
      )}
    </Box>
  </Box>
);

const SidebarFooter = ({ collapsed }) => (
  <Box sx={{ borderTop: "1px solid var(--border)", px: collapsed ? "0.8rem" : "1.1rem",
    py: "0.85rem", display: "flex", alignItems: "center", gap: collapsed ? 0 : "0.75rem",
    justifyContent: collapsed ? "center" : "flex-start", position: "relative", zIndex: 1, overflow: "hidden" }}>
    <Box sx={{ width: 32, height: 32, borderRadius: "50%",
      background: "linear-gradient(135deg, var(--violet-deep) 0%, #3C3489 100%)",
      border: "1px solid var(--border-bright)", display: "flex", alignItems: "center",
      justifyContent: "center", p: "6px", flexShrink: 0 }}>
      <AdalLogo variant="icon" height={20} />
    </Box>
    <AnimatePresence initial={false}>
      {!collapsed && (
        <Motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.16 }}
          style={{ minWidth: 0, overflow: "hidden" }}>
          <Typography sx={{ fontSize: "0.82rem", color: "var(--fog)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            ADAL Workspace
          </Typography>
          <Typography sx={{ mt: "0.1rem", color: "var(--text-muted)", fontSize: "0.66rem",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Authenticated Session
          </Typography>
        </Motion.div>
      )}
    </AnimatePresence>
  </Box>
);

const SidebarContent = ({ collapsed, isMobile, onToggleCollapse, onNavigate }) => (
  <Box sx={sidebarShellSx}>
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column",
      position: "relative", zIndex: 1, overflow: "hidden" }}>
      <SidebarLogo collapsed={collapsed} />
      {!isMobile && <SidebarCollapseControl collapsed={collapsed} onToggleCollapse={onToggleCollapse} />}

      <CaseSelector collapsed={collapsed} />

      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", pt: "0.5rem",
        scrollbarWidth: "thin", scrollbarColor: "var(--border-bright) transparent",
        "&::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-thumb": { backgroundColor: "var(--border-bright)", borderRadius: "999px" } }}>
        {navSections.map((section, index) => (
          <React.Fragment key={section.label}>
            <SidebarSection section={section} collapsed={collapsed} onNavigate={onNavigate} />
            {index < navSections.length - 1 && (
              <Box sx={{ height: "1px", backgroundColor: "var(--border)",
                mx: collapsed ? "0.8rem" : "1.1rem", my: "0.6rem" }} />
            )}
          </React.Fragment>
        ))}
      </Box>

      <SidebarFooter collapsed={collapsed} />
    </Box>
  </Box>
);

export default function AppSidebar({ open: mobileOpen = false, onClose }) {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.SIDEBAR_MINI);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {}
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try { window.localStorage.setItem(STORAGE_KEYS.SIDEBAR_MINI, String(next)); } catch {}
      return next;
    });
  }, []);

  const handleNavigate = useCallback(() => {
    if (isMobile && onClose) onClose();
  }, [isMobile, onClose]);

  const desktopWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  if (isMobile) {
    return (
      <Drawer variant="temporary" open={Boolean(mobileOpen)} onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{ "& .MuiDrawer-paper": { width: DRAWER_WIDTH, background: "transparent",
          borderRight: "none", boxShadow: "0 18px 44px rgba(0, 0, 0, 0.3)" } }}>
        <SidebarContent collapsed={false} isMobile onToggleCollapse={handleToggleCollapse}
          onNavigate={handleNavigate} />
      </Drawer>
    );
  }

  return (
    <Motion.div animate={{ width: desktopWidth }} transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      style={{ height: "100vh", flexShrink: 0, position: "sticky", top: 0,
        alignSelf: "flex-start", overflow: "visible" }}>
      <SidebarContent collapsed={collapsed} isMobile={false}
        onToggleCollapse={handleToggleCollapse} onNavigate={handleNavigate} />
    </Motion.div>
  );
}
