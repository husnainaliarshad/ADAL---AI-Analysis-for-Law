import React, { useState } from "react";
import { Box, TextField, Typography, Link, FormControlLabel, Checkbox, IconButton, InputAdornment, alpha, Alert } from "@mui/material";
import { Link as RouterLink } from 'react-router-dom';
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import AtlasButton from "../common/AtlasButton";
import { setAccessToken, setRefreshToken } from "../../utils/tokenStorage";
import authApi from "../../api/authApi";
import { validateEmailField } from "../../utils/validators";
import { getApiErrorMessage } from "../../utils/errorMessage";

export default function LoginForm() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const validate = () => {
    const newErrors = {};
    const emailRes = validateEmailField(formData.email);
    if (!emailRes.ok) newErrors.email = emailRes.errors[0];
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setGlobalError("");
    try {
      const res = await authApi.login({
        email: formData.email,
        password: formData.password,
        remember: formData.remember,
      });
      const data = res?.data || {};
      const access = data.token || data.accessToken;
      const refresh = data.refreshToken || data.refresh_token;
      if (access) setAccessToken(access);
      if (refresh) setRefreshToken(refresh);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const msg = getApiErrorMessage(err, "Login failed");
      setGlobalError(msg);
      if (status === 400 || status === 422) {
        // map potential backend validation errors
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
            "&:hover": {
              bgcolor: alpha(theme.palette.background.default, 0.7),
            },
            "&.Mui-focused": {
              bgcolor: alpha(theme.palette.background.default, 0.7),
            },
          },
        }}
        InputLabelProps={{ sx: { color: theme.palette.text.secondary } }}
      />

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
            "&:hover": {
              bgcolor: alpha(theme.palette.background.default, 0.7),
            },
            "&.Mui-focused": {
              bgcolor: alpha(theme.palette.background.default, 0.7),
            },
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
                  "&:hover": {
                    color: theme.palette.primary.main,
                  },
                }}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 0.5,
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              name="remember"
              checked={formData.remember}
              onChange={handleChange}
              sx={{ color: theme.palette.text.secondary }}
            />
          }
          label={<Typography variant="body2" color="text.secondary">Remember me</Typography>}
        />
        <Link
          component="button"
          type="button"
          underline="hover"
          sx={{ color: theme.palette.primary.main, fontWeight: 500 }}
          onClick={() => navigate("/reset-password")}
        >
          Forgot password?
        </Link>
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
        Log in
      </AtlasButton>

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

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", mt: 0.5 }}>
        By continuing, you agree to ADAL’s {" "}
        <Link component={RouterLink} to="/terms" sx={{ color: theme.palette.primary.main, fontWeight: 500 }} underline="hover">Terms</Link>
        {" "}and{" "}
        <Link component={RouterLink} to="/privacy" sx={{ color: theme.palette.primary.main, fontWeight: 500 }} underline="hover">Privacy Policy</Link>.
      </Typography>
    </Box>
  );
}
