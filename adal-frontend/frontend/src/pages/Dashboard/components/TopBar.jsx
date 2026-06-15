import React, { useEffect, useMemo, useRef, useState } from "react";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import { AppBar, Avatar, Box, Divider, IconButton, Menu, MenuItem, Stack, Tooltip, Typography, alpha, useTheme } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import ThemeToggleButton from "../../../components/ThemeToggleButton";
import AdalLogo from "../../../components/ui/AdalLogo";
import authApi from "../../../api/authApi";
import { ROUTES } from "../../../utils/constants";
import logger from "../../../utils/logger";
import { getProfileAvatarSrc } from "../../../utils/profileAvatar";

const NOTIFICATIONS_ROUTE = "/dashboard/notifications";
const noop = () => {};

function getHeaderState(pathname) {
  const low = pathname.toLowerCase();
  if (low.includes("notifications")) {
    return { search: "Search alerts, updates, or workflow messages" };
  }
  if (low.startsWith(ROUTES.SETTINGS)) {
    return { search: "Search profile, security, notifications, or appearance" };
  }
  if (low.includes("terms")) {
    return { search: "Search terms, privacy, obligations, or liability" };
  }
  return { search: "Search documents, citations, matters, or jump to a tool" };
}

function TopBarInner({
  setMobileOpen,
  notifications = [],
  unreadCount = 0,
  notifAnchor = null,
  openNotifMenu = noop,
  closeNotifMenu = noop,
  markAllRead = noop,
  profileAnchor = null,
  openProfileMenu = noop,
  closeProfileMenu = noop,
  onProfile = noop,
  onAccount = noop,
  onLogout = noop,
  onViewAllNotifications,
  currentPathname = "/",
  navigate: navigateFn = null,
}) {
  const theme = useTheme();
  const ref = useRef(null);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [query, setQuery] = useState("");
  const state = useMemo(() => getHeaderState(currentPathname), [currentPathname]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingUser(true);
        const res = await authApi.getProfile();
        setUser(res?.data || res);
      } catch (err) {
        logger.error("Failed to fetch user profile:", err);
        setUser({ email: "User", first_name: null, last_name: null, username: null });
      } finally {
        setLoadingUser(false);
      }
    };
    load();
  }, []);

  const navigateTo = (target) => {
    if (!target) return;
    if (typeof navigateFn === "function") {
      navigateFn(target);
      return;
    }
    if (typeof window !== "undefined") {
      window.location.assign(target);
    }
  };

  useEffect(() => {
    const sync = () => {
      if (!ref.current) return;
      document.documentElement.style.setProperty("--adal-topbar-offset", `${Math.ceil(ref.current.getBoundingClientRect().height + 12)}px`);
    };
    const id = requestAnimationFrame(sync);
    window.addEventListener("resize", sync);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", sync);
    };
  }, [currentPathname, unreadCount, loadingUser]);

  const displayName = !user ? "User" : user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name || user.last_name || user.username || user.email?.split("@")[0] || "User";
  const initials = !user ? "U" : user.first_name && user.last_name ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase() : (user.first_name || user.last_name || user.username || user.email || "U")[0].toUpperCase();
  const avatarSrc = getProfileAvatarSrc(user);
  const border = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.18);
  const bright = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.34 : 0.28);
  const soft = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.06 : 0.05);
  const overlay = alpha(theme.palette.background.default, theme.palette.mode === "dark" ? 0.84 : 0.9);
  const surface = alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.92 : 0.96);
  return (
    <AppBar position="sticky" elevation={0} sx={{ bgcolor: "transparent", backgroundImage: "none", boxShadow: "none" }}>
      <Box
        ref={ref}
        sx={{
          borderBottom: `1px solid ${border}`,
          bgcolor: overlay,
          backdropFilter: "blur(18px)",
          boxShadow: `0 12px 28px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.22 : 0.06)}`,
          position: "relative",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: `linear-gradient(90deg, transparent 0%, ${alpha(theme.palette.primary.main, 0.8)} 34%, transparent 100%)`,
          },
        }}
      >
        <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 1.15, md: 1.25 }, display: "grid", gridTemplateColumns: { xs: "1fr auto", md: "minmax(0,240px) minmax(320px,1fr) auto" }, gap: { xs: 1, md: 1.5 }, alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.1, minWidth: 0 }}>
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ display: { md: "none" }, color: "text.secondary", border: `1px solid ${border}`, backgroundColor: soft, "&:hover": { color: "primary.main", backgroundColor: alpha(theme.palette.primary.main, 0.12) } }} aria-label="open sidebar">
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.1, minWidth: 0 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: "10px", border: `1px solid ${bright}`, display: "flex", alignItems: "center", justifyContent: "center", p: "6px", background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.primary.dark, 0.26)} 100%)` }}>
                <AdalLogo variant="icon" height={24} />
              </Box>
              <Box sx={{ display: "grid", gap: "0.12rem", minWidth: 0 }}>
                <AdalLogo variant="full" height={18} />
                <Typography sx={{ color: "text.secondary", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", lineHeight: 1.2, display: { xs: "none", xl: "block" } }}>AI Analysis for Law</Typography>
              </Box>
            </Box>
          </Box>

          <Box component="form" onSubmit={(e) => e.preventDefault()} sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, display: "flex", alignItems: "center", gap: 1, minHeight: 50, px: 1.5, borderRadius: "14px", border: `1px solid ${border}`, backgroundColor: surface, maxWidth: { md: 680 }, width: "100%", justifySelf: { md: "center" } }}>
            <SearchIcon sx={{ color: "text.secondary", fontSize: 18 }} />
            <Box component="input" aria-label="global workspace search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={state.search} sx={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "text.primary", fontSize: "0.9rem", fontFamily: "inherit", "&::placeholder": { color: "text.secondary", opacity: 1 } }} />
            <Typography sx={{ display: { xs: "none", lg: "inline-flex" }, px: 0.8, py: 0.45, borderRadius: "8px", border: `1px solid ${border}`, color: "text.secondary", fontSize: "0.68rem", lineHeight: 1 }}>Ctrl K</Typography>
          </Box>

          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end" sx={{ minWidth: "fit-content" }}>
            <Tooltip title="Toggle theme" arrow>
              <Box sx={{ borderRadius: "12px", border: `1px solid ${border}`, backgroundColor: soft, "& .MuiIconButton-root": { color: "text.secondary", "&:hover": { color: "primary.main", backgroundColor: alpha(theme.palette.primary.main, 0.12) } } }}>
                <ThemeToggleButton />
              </Box>
            </Tooltip>
            <Tooltip title="Notifications" arrow>
              <IconButton onClick={openNotifMenu} aria-label="notifications" sx={{ width: 40, height: 40, color: "text.secondary", border: `1px solid ${border}`, backgroundColor: soft, position: "relative", "&:hover": { color: "primary.main", backgroundColor: alpha(theme.palette.primary.main, 0.12) } }}>
                <NotificationsOutlinedIcon />
                {unreadCount > 0 && <Box sx={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, px: 0.45, borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: "primary.main", color: "primary.contrastText", fontSize: "0.62rem", fontWeight: 700, border: `2px solid ${theme.palette.background.default}` }}>{unreadCount > 9 ? "9+" : unreadCount}</Box>}
              </IconButton>
            </Tooltip>
            <Tooltip title="Account menu" arrow>
              <IconButton onClick={openProfileMenu} aria-label="account" sx={{ p: 0.5, pl: 0.45, pr: { xs: 0.5, xl: 1.1 }, borderRadius: "12px", border: `1px solid ${border}`, backgroundColor: soft, color: "text.primary", gap: 0.8, "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.1) } }}>
                <Avatar src={avatarSrc || undefined} sx={{ width: 30, height: 30, bgcolor: loadingUser ? alpha(theme.palette.primary.main, 0.18) : "primary.main", color: loadingUser ? "primary.main" : "primary.contrastText", fontSize: "0.8rem", fontWeight: 700 }}>{loadingUser ? "..." : initials}</Avatar>
                <Typography sx={{ display: { xs: "none", xl: "block" }, fontSize: "0.78rem", fontWeight: 500, maxWidth: 104, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</Typography>
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
        <Menu anchorEl={notifAnchor} open={Boolean(notifAnchor)} onClose={closeNotifMenu} MenuListProps={{ "aria-label": "notifications menu" }} PaperProps={{ sx: { mt: 1.5, minWidth: 320, maxWidth: 400, borderRadius: "16px", boxShadow: `0 20px 40px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.3 : 0.12)}`, border: `1px solid ${border}`, backgroundColor: theme.palette.background.paper, "& .MuiMenuItem-root": { px: 2, py: 1.35, transition: "background-color 0.2s ease", "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.08) } } } }} transformOrigin={{ horizontal: "right", vertical: "top" }} anchorOrigin={{ horizontal: "right", vertical: "bottom" }}>
          <Box sx={{ px: 2, py: 1.6, borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}` }}>
            <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", lineHeight: 1, color: "text.primary" }}>Notifications</Typography>
            <Typography sx={{ mt: 0.45, color: "text.secondary", fontSize: "0.78rem" }}>{unreadCount > 0 ? `${unreadCount} unread item${unreadCount === 1 ? "" : "s"}` : "No unread items"}</Typography>
          </Box>
          {notifications.length === 0 ? <Box sx={{ px: 2, py: 4, textAlign: "center" }}><Typography variant="body2" color="text.secondary">No notifications</Typography></Box> : <Box sx={{ maxHeight: 360, overflowY: "auto" }}>{notifications.map((n) => <MenuItem key={n.id} onClick={closeNotifMenu} sx={{ opacity: n.read ? 0.72 : 1, borderLeft: n.read ? "none" : `2px solid ${theme.palette.primary.main}`, pl: n.read ? 2 : 1.75 }}><Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" sx={{ color: "text.primary", fontWeight: n.read ? 400 : 600 }}>{n.text}</Typography></Box></MenuItem>)}</Box>}
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={() => { markAllRead(); closeNotifMenu(); }} disabled={unreadCount === 0}><MarkEmailReadOutlinedIcon fontSize="small" sx={{ mr: 1.2, color: "text.secondary" }} /><Typography variant="body2">Mark all as read</Typography></MenuItem>
          <MenuItem onClick={() => { if (typeof onViewAllNotifications === "function") onViewAllNotifications(); else navigateTo(NOTIFICATIONS_ROUTE); closeNotifMenu(); }}><NotificationsOutlinedIcon fontSize="small" sx={{ mr: 1.2, color: "text.secondary" }} /><Typography variant="body2">View all notifications</Typography></MenuItem>
        </Menu>

        <Menu anchorEl={profileAnchor} open={Boolean(profileAnchor)} onClose={closeProfileMenu} PaperProps={{ sx: { mt: 1.5, minWidth: 230, borderRadius: "16px", boxShadow: `0 20px 40px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.3 : 0.12)}`, border: `1px solid ${border}`, backgroundColor: theme.palette.background.paper, "& .MuiMenuItem-root": { px: 2, py: 1.35, transition: "background-color 0.2s ease", "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.08) } } } }} transformOrigin={{ horizontal: "right", vertical: "top" }} anchorOrigin={{ horizontal: "right", vertical: "bottom" }}>
          <Box sx={{ px: 2, py: 1.8, borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`, backgroundColor: alpha(theme.palette.primary.main, 0.04) }}>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Avatar src={avatarSrc || undefined} sx={{ width: 38, height: 38, bgcolor: "primary.main", color: "primary.contrastText", fontWeight: 700 }}>{loadingUser ? "..." : initials}</Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: "text.primary", fontWeight: 600, fontSize: "0.92rem" }}>{displayName}</Typography>
                <Typography sx={{ color: "text.secondary", fontSize: "0.78rem" }}>{user?.email || "User"}</Typography>
              </Box>
            </Stack>
          </Box>
          <MenuItem onClick={() => { onAccount(); closeProfileMenu(); }}><DashboardOutlinedIcon fontSize="small" sx={{ color: "text.secondary", mr: 1.2 }} /><Typography variant="body2">Dashboard</Typography></MenuItem>
          <MenuItem onClick={() => { onProfile(); closeProfileMenu(); }}><SettingsOutlinedIcon fontSize="small" sx={{ color: "text.secondary", mr: 1.2 }} /><Typography variant="body2">Profile Settings</Typography></MenuItem>
          <MenuItem onClick={() => { navigateTo(ROUTES.DOCUMENTS); closeProfileMenu(); }}><DescriptionOutlinedIcon fontSize="small" sx={{ color: "text.secondary", mr: 1.2 }} /><Typography variant="body2">Documents</Typography></MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={() => { onLogout(); closeProfileMenu(); }} sx={{ color: "error.main", "&:hover": { backgroundColor: alpha(theme.palette.error.main, 0.08) } }}><LogoutOutlinedIcon fontSize="small" sx={{ mr: 1.2 }} /><Typography variant="body2" sx={{ fontWeight: 500 }}>Logout</Typography></MenuItem>
        </Menu>
      </Box>
    </AppBar>
  );
}

function TopBarWithRouter(props) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <TopBarInner
      {...props}
      navigate={navigate}
      currentPathname={location.pathname}
    />
  );
}

export default function TopBar(props) {
  const inRouter = useInRouterContext();

  if (inRouter) {
    return <TopBarWithRouter {...props} />;
  }

  const fallbackPath =
    typeof window !== "undefined" && window.location?.pathname
      ? window.location.pathname
      : "/";

  return <TopBarInner {...props} currentPathname={fallbackPath} />;
}
