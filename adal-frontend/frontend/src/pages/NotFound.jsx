import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import ThemeToggleButton from "../components/ThemeToggleButton";

export default function NotFound() {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: theme.palette.background.default,
        color: theme.palette.text.primary,
        p: 3,
        position: "relative",
      }}
    >
      <Box sx={{ textAlign: "center", maxWidth: 560 }}>
        <Typography
          variant="h1"
          color="primary"
          fontWeight={800}
          sx={{ fontSize: { xs: "3rem", sm: "4rem" } }}
        >
          404
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mt: 1 }}>
          Page not found
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          The page you’re looking for doesn’t exist or has been moved.
        </Typography>

        <Box sx={{ display: "flex", gap: 2, justifyContent: "center", mt: 3, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/")}
            sx={{ px: 3, py: 1, fontWeight: 600, borderRadius: theme.shape.borderRadius }}
          >
            Go Home
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate("/login")}
            sx={{ px: 3, py: 1, fontWeight: 600, borderRadius: theme.shape.borderRadius }}
          >
            Sign in
          </Button>
        </Box>
      </Box>

      {/* Floating Theme Toggle */}
      <Box sx={{ position: "fixed", bottom: 16, right: 16, zIndex: 1000 }}>
        <ThemeToggleButton />
      </Box>
    </Box>
  );
}