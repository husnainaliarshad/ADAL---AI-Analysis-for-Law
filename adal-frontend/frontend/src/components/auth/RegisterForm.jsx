import React, { useState } from "react";
import { Box, TextField, Typography, Link, IconButton, InputAdornment, alpha, Alert } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTheme } from "@mui/material/styles";
import AtlasButton from "../common/AtlasButton";
import authApi from "../../api/authApi";
import { validateEmailField, validatePassword } from "../../utils/validators";
import { getApiErrorMessage } from "../../utils/errorMessage";

export default function RegisterForm() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.firstName) newErrors.firstName = "First name is required";
    if (!formData.lastName) newErrors.lastName = "Last name is required";
    const emailRes = validateEmailField(formData.email);
    if (!emailRes.ok) newErrors.email = emailRes.errors[0];
    if (!formData.password) newErrors.password = "Password is required";
    else {
      const pwd = validatePassword(formData.password, { minLength: 8 });
      if (!pwd.ok) newErrors.password = pwd.errors[0];
    }
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setGlobalError("");
    setSuccessMsg("");
    try {
      // Generate username from first and last name (or use email prefix as fallback)
      const username = `${formData.firstName}${formData.lastName}`.toLowerCase().replace(/\s+/g, '') || formData.email.split('@')[0];
      
      await authApi.register({
        username: username,
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
      });
      // On successful registration, redirect user to Login page
      // Pass a flag so Login can optionally show a success message
      setSuccessMsg("Registration successful. Redirecting to login...");
      navigate('/login', { replace: true, state: { registered: true, email: formData.email } });
    } catch (err) {
      const status = err?.response?.status;
      const msg = getApiErrorMessage(err, "Registration failed");
      setGlobalError(msg);
      if (status === 400 || status === 422) {
        const apiErrors = err?.response?.data?.errors;
        if (apiErrors && typeof apiErrors === 'object') {
          setErrors((prev) => ({ ...prev, ...apiErrors }));
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      autoComplete="off"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        width: "100%",
        mt: 0,
      }}
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, "& > *": { minWidth: "calc(50% - 5px)", flex: "1 1 140px" } }}>
        <TextField
          name="firstName"
            label="First Name"
            variant="outlined"
            value={formData.firstName}
            onChange={handleChange}
            error={!!errors.firstName}
            helperText={errors.firstName}
            fullWidth
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: alpha(theme.palette.background.default, 0.5),
                "&:hover": { bgcolor: alpha(theme.palette.background.default, 0.7) },
                "&.Mui-focused": { bgcolor: alpha(theme.palette.background.default, 0.7) },
              },
            }}
            InputLabelProps={{ sx: { color: theme.palette.text.secondary } }}
          />
        <TextField
          name="lastName"
            label="Last Name"
            variant="outlined"
            value={formData.lastName}
            onChange={handleChange}
            error={!!errors.lastName}
            helperText={errors.lastName}
            fullWidth
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: alpha(theme.palette.background.default, 0.5),
                "&:hover": { bgcolor: alpha(theme.palette.background.default, 0.7) },
                "&.Mui-focused": { bgcolor: alpha(theme.palette.background.default, 0.7) },
              },
            }}
            InputLabelProps={{ sx: { color: theme.palette.text.secondary } }}
          />
      </Box>

      <TextField
        name="email"
        label="Email Address"
        type="email"
        variant="outlined"
        value={formData.email}
        onChange={handleChange}
        error={!!errors.email}
        helperText={errors.email}
        fullWidth
        size="small"
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: alpha(theme.palette.background.default, 0.5),
            "&:hover": { bgcolor: alpha(theme.palette.background.default, 0.7) },
            "&.Mui-focused": { bgcolor: alpha(theme.palette.background.default, 0.7) },
          },
        }}
        InputLabelProps={{ sx: { color: theme.palette.text.secondary } }}
      />

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, "& > *": { minWidth: "calc(50% - 5px)", flex: "1 1 140px" } }}>
        <TextField
            name="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            variant="outlined"
            value={formData.password}
            onChange={handleChange}
            error={!!errors.password}
            helperText={errors.password}
            fullWidth
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: alpha(theme.palette.background.default, 0.5),
                "&:hover": { bgcolor: alpha(theme.palette.background.default, 0.7) },
                "&.Mui-focused": { bgcolor: alpha(theme.palette.background.default, 0.7) },
              },
            }}
            InputLabelProps={{ sx: { color: theme.palette.text.secondary } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    sx={{
                      color: theme.palette.text.secondary,
                      "&:hover": { color: theme.palette.primary.main },
                    }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        <TextField
          name="confirmPassword"
            label="Confirm Password"
            type="password"
            variant="outlined"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            fullWidth
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: alpha(theme.palette.background.default, 0.5),
                "&:hover": { bgcolor: alpha(theme.palette.background.default, 0.7) },
                "&.Mui-focused": { bgcolor: alpha(theme.palette.background.default, 0.7) },
              },
            }}
            InputLabelProps={{ sx: { color: theme.palette.text.secondary } }}
          />
      </Box>

      <AtlasButton
        type="submit"
        variant="contained"
        loading={submitting}
        loadingPosition="center"
        sx={{
          mt: 0.75,
          py: 1.2,
          fontWeight: 600,
          borderRadius: theme.shape.borderRadius,
          backgroundColor: theme.palette.primary.main,
          "&:hover": { backgroundColor: theme.palette.primary.dark },
        }}
      >
        Continue
      </AtlasButton>

      {successMsg && (
        <Alert
          severity="success"
          sx={{
            mt: 1,
            borderRadius: 2,
            "& .MuiAlert-message": {
              width: "100%",
            },
          }}
        >
          {successMsg}
        </Alert>
      )}
      {globalError && (
        <Alert
          severity="error"
          sx={{
            mt: 1,
            borderRadius: 2,
            "& .MuiAlert-message": {
              width: "100%",
            },
          }}
        >
          {globalError}
        </Alert>
      )}

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: "center", mt: 1 }}
      >
        By continuing, you agree to ADAL’s{" "}
        <Link
          underline="hover"
          component={RouterLink}
          to="/terms"
          sx={{ color: theme.palette.primary.main, fontWeight: 500 }}
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          underline="hover"
          component={RouterLink}
          to="/privacy"
          sx={{ color: theme.palette.primary.main, fontWeight: 500 }}
        >
          Privacy Policy
        </Link>
        .
      </Typography>
    </Box>
  );
}
