import React from "react";
import { Avatar, Box, Stack, Typography } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { motion as Motion } from "framer-motion";
import { Link as RouterLink } from "react-router-dom";
import ThemeToggleButton from "../components/ThemeToggleButton";
import AdalLogo from "../components/ui/AdalLogo";
import { ROUTES } from "../utils/constants";

const palette = {
  obsidian: "var(--obsidian)",
  surface: "var(--surface)",
  surfaceAlt: "var(--surface-alt)",
  surfaceSoft: "var(--surface-soft)",
  violet: "var(--violet)",
  violetDim: "var(--violet-dim)",
  lavender: "var(--lavender)",
  fog: "var(--fog)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  border: "var(--border)",
  borderBright: "var(--border-bright)",
  fontDisplay: "var(--font-display)",
  fontBody: "var(--font-body)",
};

const navLinks = [
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Team", href: "#team" },
];

const aboutBlocks = [
  {
    title: "Vision",
    body:
      "To shape a legal workflow where AI reduces the burden of repetitive review, fragmented research, and document-heavy analysis without diluting professional judgment.",
  },
  {
    title: "Mission",
    body:
      "To provide a structured system for legal summarization, citation verification, claim extraction, research support, and drafting assistance that feels credible, modern, and useful in real legal work.",
  },
];

const services = [
  {
    icon: DescriptionRoundedIcon,
    title: "Document Analysis",
    description:
      "Turn dense legal material into structured insight with clearer review paths and faster understanding.",
  },
  {
    icon: FactCheckRoundedIcon,
    title: "Citation Verification",
    description:
      "Extract citations and validate them through AI-assisted workflows with confidence-oriented outputs.",
  },
  {
    icon: GavelRoundedIcon,
    title: "Claim Extraction",
    description:
      "Identify core assertions and legal points so users can inspect arguments more systematically.",
  },
  {
    icon: EditNoteRoundedIcon,
    title: "Drafting Support",
    description:
      "Use document-aware drafting assistance to move from notes and findings to better first drafts.",
  },
  {
    icon: SearchRoundedIcon,
    title: "Research Workflow",
    description:
      "Bring retrieval, precedent search, and summarization into one connected legal workspace.",
  },
  {
    icon: AutoAwesomeRoundedIcon,
    title: "AI Intelligence Layer",
    description:
      "Make ADAL feel less like a collection of tools and more like a coherent legal analysis system.",
  },
];

const teamMembers = [
  {
    name: "Hassan Ali",
    role: "Product & Research Lead",
    id: "22I-0919",
    note: "Drafted project reports and built embeddings for the RAG pipeline.",
  },
  {
    name: "Abdullah Azeem",
    role: "Frontend Experience Lead",
    id: "22I-1186",
    photo: "/team/abdullah-azeem.jpg",
    note: "Led frontend experience and also contributed to backend work.",
  },
  {
    name: "Husnain Ali Arshad",
    role: "AI & Backend Systems Lead",
    id: "22I-1335",
    photo: "/team/husnain-ali-arshad.jpeg",
    note: "Led the AI and backend systems side of the project.",
  },
];

const sectionReveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.55, ease: "easeOut" },
};

const pagePaddingX = "var(--page-gutter)";
const sectionMaxWidth = "var(--content-max)";

function SectionLabel({ children }) {
  return (
    <Typography
      sx={{
        fontSize: "0.68rem",
        letterSpacing: "0.25em",
        textTransform: "uppercase",
        color: palette.violet,
        mb: 1.2,
      }}
    >
      {children}
    </Typography>
  );
}

function NavAnchor({ href, children }) {
  return (
    <Box
      component="a"
      href={href}
      sx={{
        fontSize: "0.78rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: palette.textSecondary,
        textDecoration: "none",
        transition: "color 0.2s ease",
        "&:hover": {
          color: palette.fog,
          textDecoration: "none",
        },
      }}
    >
      {children}
    </Box>
  );
}

export default function Landing() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: palette.obsidian,
        color: palette.fog,
        fontFamily: palette.fontBody,
        overflowX: "hidden",
      }}
    >
      <Box
        component="nav"
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: pagePaddingX,
          py: "1.25rem",
          borderBottom: `0.5px solid ${palette.border}`,
          backgroundColor: "var(--surface-overlay)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <AdalLogo
            variant="full"
            height={34}
            sx={{
              filter: "drop-shadow(0 0 14px var(--glow-soft))",
            }}
          />
        </Box>

        <Stack direction="row" spacing="2.5rem" sx={{ display: { xs: "none", md: "flex" } }}>
          {navLinks.map((link) => (
            <NavAnchor key={link.label} href={link.href}>
              {link.label}
            </NavAnchor>
          ))}
          <NavAnchor href={ROUTES.LOGIN}>Login</NavAnchor>
        </Stack>
      </Box>

      <Box
        component="section"
        id="hero"
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          px: { xs: "1.5rem", md: "2rem" },
          pt: "6rem",
          pb: { xs: "6rem", md: "7rem" },
          position: "relative",
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
            backgroundSize: "60px 60px",
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, var(--glow-soft) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -55%)",
            pointerEvents: "none",
          }}
        />

        <Motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          style={{ position: "relative", zIndex: 2 }}
        >
          <Box sx={{ display: "flex", justifyContent: "center", mb: "1.6rem" }}>
            <AdalLogo
              variant="icon"
              height={72}
              sx={{
                filter: "drop-shadow(0 0 22px var(--glow-strong))",
              }}
            />
          </Box>

          <Typography
            sx={{
              fontSize: "0.72rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: palette.violet,
              mb: "1.8rem",
            }}
          >
            AI-Native Legal Workspace
          </Typography>

          <Typography
            sx={{
              fontFamily: palette.fontDisplay,
              fontSize: "clamp(7rem, 18vw, 13rem)",
              fontWeight: 300,
              lineHeight: 0.9,
              letterSpacing: "-0.02em",
              color: palette.fog,
            }}
          >
            AD
            <Box
              component="span"
              sx={{
                color: palette.violet,
                fontFamily: "inherit",
                fontSize: "inherit",
                lineHeight: "inherit",
              }}
            >
              A
            </Box>
            L
          </Typography>

          <Typography
            sx={{
              fontFamily: palette.fontDisplay,
              fontSize: "clamp(0.95rem, 2vw, 1.2rem)",
              fontWeight: 300,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: palette.lavender,
              mt: "1rem",
            }}
          >
            AI-Driven Analysis for Law
          </Typography>

          <Box
            sx={{
              width: 40,
              height: "0.5px",
              backgroundColor: palette.borderBright,
              mx: "auto",
              my: "2.5rem",
            }}
          />

          <Typography
            sx={{
              maxWidth: 540,
              mx: "auto",
              fontSize: "1rem",
              lineHeight: 1.8,
              color: palette.textSecondary,
            }}
          >
            Legal analysis should not be slowed down by fragmented research,
            repetitive review, and manual document handling.
            <Box component="span" sx={{ color: palette.lavender }}>
              {" "}
              ADAL brings AI-driven precision to legal workflows so you can move
              from legal text to legal intelligence.
            </Box>
          </Typography>

          <Box sx={{ mt: "2.8rem" }}>
            <Box
              component={RouterLink}
              to={ROUTES.LOGIN}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.6rem",
                px: "2.4rem",
                py: "0.85rem",
                bgcolor: palette.violet,
                color: palette.fog,
                fontSize: "0.82rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                textDecoration: "none",
                borderRadius: "var(--radius-xs)",
                transition: "background 0.2s ease, transform 0.15s ease",
                "&, &:visited": {
                  color: palette.fog,
                },
                "&:hover": {
                  bgcolor: palette.violetDim,
                  color: palette.fog,
                  textDecoration: "none",
                  transform: "translateY(-1px)",
                },
              }}
            >
              Get Started
              <ArrowOutwardRoundedIcon sx={{ width: 14, height: 14 }} />
            </Box>
          </Box>
        </Motion.div>

        <Box
          sx={{
            position: "absolute",
            bottom: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            display: { xs: "none", lg: "flex" },
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            zIndex: 1,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: palette.textMuted,
            }}
          >
            Scroll
          </Typography>
          <Box
            sx={{
              width: "0.5px",
              height: 40,
              backgroundColor: palette.borderBright,
              animation: "adalScrollPulse 2s ease-in-out infinite",
            }}
          />
        </Box>
      </Box>

      <Box
        component="section"
        id="about"
        sx={{
          borderTop: `0.5px solid ${palette.border}`,
          maxWidth: sectionMaxWidth,
          mx: "auto",
          px: { xs: "1.5rem", md: "2rem" },
          py: { xs: "5rem", md: "7rem" },
        }}
      >
        <Motion.div {...sectionReveal}>
          <SectionLabel>About</SectionLabel>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1.6fr" },
              gap: { xs: "2.5rem", md: "5rem" },
              alignItems: "start",
              mt: "3rem",
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontFamily: palette.fontDisplay,
                  fontSize: "clamp(2.4rem, 4vw, 3.5rem)",
                  fontWeight: 400,
                  lineHeight: 1.15,
                  color: palette.fog,
                }}
              >
                Built for a more <Box component="span" sx={{ color: palette.violet }}>intelligent</Box>{" "}
                legal workflow.
              </Typography>

              <Box
                sx={{
                  display: "inline-block",
                  mt: "1.5rem",
                  px: "0.9rem",
                  py: "0.3rem",
                  border: `0.5px solid ${palette.borderBright}`,
                  borderRadius: "var(--radius-xs)",
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: palette.lavender,
                }}
              >
                Vision & Mission
              </Box>
            </Box>

            <Box sx={{ pt: { md: "0.5rem" } }}>
              {aboutBlocks.map((block, index) => (
                <Box
                  key={block.title}
                  sx={{
                    py: index === 0 ? 0 : "1.8rem",
                    pb: "1.8rem",
                    borderBottom: `0.5px solid ${palette.border}`,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: palette.fontDisplay,
                      fontSize: "1.25rem",
                      fontWeight: 500,
                      color: palette.lavender,
                      mb: "0.7rem",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {block.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.95rem",
                      lineHeight: 1.85,
                      color: palette.textSecondary,
                    }}
                  >
                    {block.body}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Motion.div>
      </Box>

      <Box
        component="section"
        id="services"
        sx={{
          bgcolor: palette.surface,
          borderTop: `0.5px solid ${palette.border}`,
          borderBottom: `0.5px solid ${palette.border}`,
          px: pagePaddingX,
          py: { xs: "5rem", md: "7rem" },
        }}
      >
        <Motion.div {...sectionReveal}>
          <Box sx={{ maxWidth: sectionMaxWidth, mx: "auto" }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                alignItems: { xs: "flex-start", md: "flex-end" },
                justifyContent: "space-between",
                gap: 3,
                mb: "3.5rem",
              }}
            >
              <Box>
                <SectionLabel>Services</SectionLabel>
                <Typography
                  sx={{
                    fontFamily: palette.fontDisplay,
                    fontSize: "clamp(2rem, 3.5vw, 3rem)",
                    fontWeight: 400,
                    color: palette.fog,
                    maxWidth: 420,
                    lineHeight: 1.2,
                  }}
                >
                  A connected set of legal analysis capabilities.
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  color: palette.textMuted,
                  textTransform: "uppercase",
                }}
              >
                06 Capabilities
              </Typography>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                gap: "1px",
                bgcolor: palette.border,
              }}
            >
              {services.map((service, index) => {
                const Icon = service.icon;
                return (
                  <Box
                    key={service.title}
                    sx={{
                      bgcolor: palette.surface,
                      px: "1.8rem",
                      py: "2.2rem",
                      position: "relative",
                      overflow: "hidden",
                      transition: "background 0.2s ease",
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "1px",
                        backgroundColor: "transparent",
                        transition: "background 0.2s ease",
                      },
                      "&:hover": {
                        bgcolor: palette.surfaceAlt,
                      },
                      "&:hover::before": {
                        backgroundColor: palette.violet,
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.65rem",
                        letterSpacing: "0.2em",
                        color: palette.textMuted,
                        mb: "1.2rem",
                        textTransform: "uppercase",
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </Typography>

                    <Box sx={{ color: palette.violet, mb: "1rem" }}>
                      <Icon sx={{ width: 36, height: 36 }} />
                    </Box>

                    <Typography
                      sx={{
                        fontFamily: palette.fontDisplay,
                        fontSize: "1.2rem",
                        fontWeight: 500,
                        color: palette.fog,
                        mb: "0.7rem",
                      }}
                    >
                      {service.title}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.85rem",
                        lineHeight: 1.75,
                        color: palette.textSecondary,
                      }}
                    >
                      {service.description}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Motion.div>
      </Box>

      <Box
        component="section"
        id="team"
        sx={{
          maxWidth: sectionMaxWidth,
          mx: "auto",
          px: { xs: "1.5rem", md: "2rem" },
          py: { xs: "5rem", md: "7rem" },
        }}
      >
        <Motion.div {...sectionReveal}>
          <SectionLabel>Team</SectionLabel>
          <Typography
            sx={{
              fontFamily: palette.fontDisplay,
              fontSize: "clamp(2.2rem, 3.5vw, 3rem)",
              fontWeight: 400,
              color: palette.fog,
              mb: "1rem",
            }}
          >
            The people shaping ADAL.
          </Typography>
          <Typography
            sx={{
              fontSize: "0.92rem",
              lineHeight: 1.8,
              color: palette.textSecondary,
              maxWidth: 520,
              mb: "3.5rem",
            }}
          >
            A compact team section that feels credible, polished, and aligned
            with the rest of the product presentation.
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gap: "1.5rem",
            }}
          >
            {teamMembers.map((member) => {
              const initials = member.name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase();

              return (
                <Box
                  key={member.id}
                  sx={{
                    bgcolor: palette.surface,
                    border: `0.5px solid ${palette.border}`,
                    borderRadius: "var(--radius-m)",
                    px: "1.5rem",
                    pt: "2.5rem",
                    pb: "2rem",
                    textAlign: "center",
                    transition: "border-color 0.2s ease, transform 0.2s ease",
                    "&:hover": {
                      borderColor: palette.borderBright,
                      transform: "translateY(-3px)",
                    },
                  }}
                >
                  <Avatar
                    src={member.photo}
                    alt={member.name}
                    imgProps={
                      member.photo
                        ? {
                            style: {
                              objectFit: "cover",
                              objectPosition: "center 20%",
                            },
                          }
                        : undefined
                    }
                    sx={{
                      width: 90,
                      height: 90,
                      mx: "auto",
                      mb: "1.4rem",
                      bgcolor: palette.surfaceSoft,
                      border: `1.5px solid ${palette.borderBright}`,
                      color: palette.lavender,
                      fontFamily: palette.fontDisplay,
                      fontSize: "1.6rem",
                      fontWeight: 400,
                      letterSpacing: "0.05em",
                      boxShadow: member.photo
                        ? "0 16px 28px rgba(0, 0, 0, 0.18)"
                        : "none",
                    }}
                  >
                    {initials || "A"}
                  </Avatar>

                  <Typography
                    sx={{
                      fontFamily: palette.fontDisplay,
                      fontSize: "1.2rem",
                      fontWeight: 500,
                      color: palette.fog,
                      mb: "0.3rem",
                    }}
                  >
                    {member.name}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.78rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: palette.violet,
                    }}
                  >
                    {member.role}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.72rem",
                      color: palette.textMuted,
                      mt: "0.2rem",
                    }}
                  >
                    {member.id}
                  </Typography>
                  <Typography
                    sx={{
                      mt: "0.9rem",
                      fontSize: "0.82rem",
                      lineHeight: 1.7,
                      color: palette.textSecondary,
                    }}
                  >
                    {member.note}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Motion.div>
      </Box>

      <Box
        component="footer"
        sx={{
          borderTop: `0.5px solid ${palette.border}`,
          px: pagePaddingX,
          py: "3rem",
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 2.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <AdalLogo
            variant="full"
            height={28}
            sx={{
              opacity: 0.72,
            }}
          />
        </Box>

        <Stack direction="row" spacing="2rem" flexWrap="wrap" useFlexGap>
          {navLinks.map((link) => (
            <NavAnchor key={link.label} href={link.href}>
              {link.label}
            </NavAnchor>
          ))}
          <NavAnchor href={ROUTES.LOGIN}>Login</NavAnchor>
        </Stack>

        <Typography
          sx={{
            fontSize: "0.72rem",
            letterSpacing: "0.08em",
            color: palette.textMuted,
            textAlign: { xs: "left", md: "right" },
            lineHeight: 1.7,
            textTransform: "uppercase",
          }}
        >
          Final Year Project
          <br />
          AI-Driven Analysis for Law
        </Typography>
      </Box>

      <Box sx={{ position: "fixed", right: 16, bottom: 16, zIndex: 1000 }}>
        <ThemeToggleButton />
      </Box>
    </Box>
  );
}
