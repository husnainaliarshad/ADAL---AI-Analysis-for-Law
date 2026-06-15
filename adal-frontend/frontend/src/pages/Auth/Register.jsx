import React from "react";
import { Box, alpha } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import AuthShell from "../../components/auth/AuthShell";
import RegisterForm from "../../components/auth/RegisterForm";
import logger from "../../utils/logger";

export default function Register() {
  const theme = useTheme();

  const handleGoogleSignUp = () => {
    logger.debug("Google signup clicked");
    // TODO: Connect this to backend OAuth later
  };

  const topAdornment = (
    <Box
      sx={{
        p: 1.8,
        borderRadius: "var(--radius-m)",
        bgcolor: alpha(theme.palette.primary.main, 0.1),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <PersonAddIcon sx={{ fontSize: 28, color: "primary.main" }} />
    </Box>
  );

  return (
    <AuthShell
      mode="register"
      formTitle="Create your account."
      formSubtitle="Join ADAL and modernise your legal workflow."
      socialLabel="Continue with Google"
      onSocialClick={handleGoogleSignUp}
      form={<RegisterForm />}
      footerPrompt="Already have an account?"
      footerActionLabel="Sign in"
      footerActionTo="/login"
      topAdornment={topAdornment}
      formMaxWidth={456}
    />
  );
}
