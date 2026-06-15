import React from "react";
import {
  Box,
  Button,
  Card,
  Divider,
  IconButton,
  Link,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion as Motion } from "framer-motion";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GoogleIcon from "@mui/icons-material/Google";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import ThemeToggleButton from "../ThemeToggleButton";
import GlowingEffect from "../ui/GlowingEffect";
import AdalLogo from "../ui/AdalLogo";
import { ROUTES } from "../../utils/constants";

const featureList = [
  "OCR-powered document ingestion in English and Urdu",
  "Automatic citation verification with confidence scores",
  "Drafting and research support grounded in Pakistani case law",
];

export default function AuthShell({
  mode,
  formTitle,
  formSubtitle,
  form,
  alert,
  footerPrompt,
  footerActionLabel,
  footerActionTo,
  socialLabel,
  onSocialClick,
  formMaxWidth = 420,
  topAdornment = null,
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const primaryGlow = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.15 : 0.12);
  const primaryGlowSoft = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.07);
  const contentMax = theme.customTokens?.layout?.contentMax || "var(--content-max)";
  const isLogin = mode === "login";

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "1.02fr 0.98fr" },
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "relative",
          bgcolor: "background.paper",
          borderRight: { lg: `0.5px solid ${theme.palette.divider}` },
          borderBottom: { xs: `0.5px solid ${theme.palette.divider}`, lg: "none" },
          px: { xs: "1.5rem", md: "2.25rem", xl: "2.75rem" },
          py: { xs: "1.75rem", md: "2.25rem", xl: "2.75rem" },
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(var(--grid-line) 1px, transparent 1px),
              linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            width: { xs: 320, md: 480 },
            height: { xs: 320, md: 480 },
            borderRadius: "50%",
            background: `radial-gradient(circle, ${primaryGlow} 0%, transparent 68%)`,
            bottom: { xs: -140, md: -110 },
            right: { xs: -140, md: -110 },
            pointerEvents: "none",
          }}
        />

        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <AdalLogo variant="full" height={40} />
          </Motion.div>
        </Box>

        <Box sx={{ position: "relative", zIndex: 1, py: { xs: 3, lg: 4.5 } }}>
          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
          >
            <Typography
              sx={{
                fontSize: { xs: "2rem", md: "2.45rem", xl: "2.8rem" },
                fontFamily: "var(--font-display)",
                fontWeight: 300,
                lineHeight: 1.12,
                color: "text.primary",
                mb: 1.5,
                maxWidth: "13ch",
              }}
            >
              The law is complex.
              <br />
              Your tools
              <br />
              <Box component="span" sx={{ color: "primary.main" }}>
                shouldn&apos;t be.
              </Box>
            </Typography>

            <Typography
              sx={{
                fontSize: "0.88rem",
                lineHeight: 1.8,
                color: "text.secondary",
                maxWidth: 420,
                mb: 2.25,
              }}
            >
              ADAL streamlines legal research, citation checks, and drafting so legal work
              feels faster, clearer, and less repetitive.
            </Typography>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25 }}
          >
            <Stack spacing={0.9} sx={{ maxWidth: 430 }}>
              {featureList.map((item) => (
                <Box key={item} sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                  <Box
                    sx={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      flexShrink: 0,
                    }}
                  />
                  <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", lineHeight: 1.65 }}>
                    {item}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Motion.div>
        </Box>

        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Typography
            sx={{
              fontSize: "0.68rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "text.secondary",
              lineHeight: 1.8,
            }}
          >
            Department of Computer Science
            <br />
            National University of Computer and Emerging Sciences
            <br />
            Islamabad, Pakistan
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          position: "relative",
          display: "flex",
          alignItems: { xs: "flex-start", lg: "center" },
          justifyContent: "center",
          px: { xs: "1rem", sm: "1.5rem", md: "2rem" },
          py: { xs: "1.5rem", md: "2.5rem" },
          minHeight: { xs: "auto", lg: "100vh" },
        }}
      >
        <Motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          style={{ width: "100%", maxWidth: contentMax }}
        >
          <Box sx={{ width: "100%", maxWidth: formMaxWidth, mx: "auto" }}>
            <Box sx={{ mb: 2.25 }}>
              <Link
                component="button"
                type="button"
                onClick={() => navigate(ROUTES.ROOT)}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  mb: 1.25,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontSize: "0.72rem",
                  textDecoration: "none",
                  "&:hover": {
                    color: "primary.main",
                    textDecoration: "none",
                  },
                }}
              >
                <ArrowBackIcon sx={{ fontSize: 14 }} />
                Back to home
              </Link>

              <Box
                sx={{
                  display: "flex",
                  bgcolor: "background.paper",
                  border: `0.5px solid ${theme.palette.divider}`,
                  borderRadius: "var(--radius-m)",
                  p: "3px",
                  width: "100%",
                }}
              >
                <Button
                  fullWidth
                  onClick={() => navigate(ROUTES.LOGIN)}
                  sx={{
                    py: 1,
                    borderRadius: "var(--radius-s)",
                    color: isLogin ? theme.palette.primary.contrastText : theme.palette.text.secondary,
                    bgcolor: isLogin ? "primary.main" : "transparent",
                    "&:hover": {
                      bgcolor: isLogin ? "primary.main" : alpha(theme.palette.primary.main, 0.08),
                    },
                  }}
                >
                  Sign In
                </Button>
                <Button
                  fullWidth
                  onClick={() => navigate(ROUTES.REGISTER)}
                  sx={{
                    py: 1,
                    borderRadius: "var(--radius-s)",
                    color: !isLogin ? theme.palette.primary.contrastText : theme.palette.text.secondary,
                    bgcolor: !isLogin ? "primary.main" : "transparent",
                    "&:hover": {
                      bgcolor: !isLogin ? "primary.main" : alpha(theme.palette.primary.main, 0.08),
                    },
                  }}
                >
                  Register
                </Button>
              </Box>
            </Box>

            <Card
              elevation={0}
              sx={{
                p: { xs: 2.25, sm: 3.25 },
                width: "100%",
                position: "relative",
                overflow: "hidden",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  background: `radial-gradient(circle at top right, ${primaryGlowSoft} 0%, transparent 38%)`,
                  pointerEvents: "none",
                },
              }}
            >
              <GlowingEffect spread={32} proximity={70} inactiveZone={0.04} borderWidth={1.2} />

              <Box sx={{ position: "relative", zIndex: 1 }}>
                {alert}

                {topAdornment && <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>{topAdornment}</Box>}

                <Typography
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: { xs: "1.9rem", md: "2.1rem" },
                    fontWeight: 400,
                    color: "text.primary",
                    mb: 0.35,
                    textAlign: "center",
                  }}
                >
                  {formTitle}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.88rem",
                    color: "text.secondary",
                    textAlign: "center",
                    mb: 2.25,
                    lineHeight: 1.7,
                  }}
                >
                  {formSubtitle}
                </Typography>

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={onSocialClick}
                  startIcon={<GoogleIcon />}
                  sx={{
                    py: 1.3,
                    mb: 1.75,
                    borderColor: alpha(theme.palette.divider, 0.9),
                    color: "text.primary",
                    "&:hover": {
                      borderColor: "primary.main",
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  {socialLabel}
                </Button>

                <Divider
                  sx={{
                    my: 1.5,
                    color: "text.secondary",
                    fontSize: "0.72rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    "&::before, &::after": {
                      borderColor: alpha(theme.palette.divider, 0.9),
                    },
                  }}
                >
                  or continue with email
                </Divider>

                {form}

                <Typography
                  sx={{
                    mt: 2,
                    fontSize: "0.86rem",
                    color: "text.secondary",
                    textAlign: "center",
                  }}
                >
                  {footerPrompt}{" "}
                  <Link
                    component={RouterLink}
                    to={footerActionTo}
                    underline="hover"
                    sx={{
                      color: "primary.main",
                      fontWeight: 500,
                      cursor: "pointer",
                      "&:hover": {
                        color: "primary.main",
                      },
                    }}
                  >
                    {footerActionLabel}
                  </Link>
                </Typography>
              </Box>
            </Card>
          </Box>
        </Motion.div>
      </Box>

      <Box sx={{ position: "fixed", right: 16, bottom: 16, zIndex: 1000 }}>
        <ThemeToggleButton />
      </Box>
    </Box>
  );
}
