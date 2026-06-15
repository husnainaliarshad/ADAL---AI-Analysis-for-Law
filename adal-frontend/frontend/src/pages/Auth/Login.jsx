import React from "react";
import { Alert, alpha } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useLocation } from "react-router-dom";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AuthShell from "../../components/auth/AuthShell";
import LoginForm from "../../components/auth/LoginForm";
import logger from "../../utils/logger";

export default function Login() {
  const theme = useTheme();
  const location = useLocation();

  const handleGoogleSignIn = () => {
    logger.debug("Google login clicked");
    // TODO: Connect this to backend OAuth later
  };

  const alert = location.state?.registered || location.state?.passwordReset ? (
    <Alert
      severity="success"
      icon={<CheckCircleIcon />}
      sx={{
        mb: 3,
        textAlign: "left",
        borderRadius: 2,
        bgcolor: alpha(theme.palette.success.main, 0.12),
        border: `1px solid ${alpha(theme.palette.success.main, 0.22)}`,
      }}
    >
      {location.state?.passwordReset
        ? "Password reset successfully. Please sign in with your new password."
        : "Account created successfully. Please log in."}
    </Alert>
  ) : null;

  return (
    <AuthShell
      mode="login"
      formTitle="Welcome back."
      formSubtitle="Sign in to your ADAL account to continue."
      socialLabel="Continue with Google"
      onSocialClick={handleGoogleSignIn}
      form={<LoginForm />}
      alert={alert}
      footerPrompt="Don't have an account?"
      footerActionLabel="Create one"
      footerActionTo="/register"
      formMaxWidth={420}
    />
  );
}
