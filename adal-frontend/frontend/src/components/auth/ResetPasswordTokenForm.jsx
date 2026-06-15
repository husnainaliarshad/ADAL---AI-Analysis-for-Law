import React, { useState, useEffect } from "react";
import { Box, TextField, Typography, Alert, IconButton, InputAdornment } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import AtlasButton from "../common/AtlasButton";
import { validatePassword } from "../../utils/validators";
import authApi from "../../api/authApi";
import { getApiErrorMessage } from "../../utils/errorMessage";

export default function ResetPasswordTokenForm({ token }) {
	const theme = useTheme();
	const navigate = useNavigate();

	const [formData, setFormData] = useState({
		newPassword: "",
		confirmPassword: "",
	});

	const [errors, setErrors] = useState({});
	const [globalError, setGlobalError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	useEffect(() => {
		// Clear errors when form data changes
		if (Object.keys(errors).length > 0) {
			setErrors({});
		}
		if (globalError) {
			setGlobalError("");
		}
	}, [formData]);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData({ ...formData, [name]: value });
		// Clear field-specific error when user starts typing
		if (errors[name]) {
			setErrors({ ...errors, [name]: "" });
		}
		if (globalError) {
			setGlobalError("");
		}
	};

	const validate = () => {
		const newErrors = {};

		// Validate new password
		if (!formData.newPassword) {
			newErrors.newPassword = "New password is required";
		} else {
			const pwd = validatePassword(formData.newPassword, { minLength: 8 });
			if (!pwd.ok) {
				newErrors.newPassword = pwd.errors[0];
			}
		}

		// Validate confirm password
		if (!formData.confirmPassword) {
			newErrors.confirmPassword = "Please confirm your password";
		} else if (formData.newPassword !== formData.confirmPassword) {
			newErrors.confirmPassword = "Passwords do not match";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!validate()) return;

		setSubmitting(true);
		setGlobalError("");
		setSuccessMessage("");

		try {
			await authApi.resetPassword({
				token: token,
				new_password: formData.newPassword,
			});

			// Success - show message and redirect
			setSuccessMessage("Password has been reset successfully!");

			// Redirect to login after 2 seconds
			setTimeout(() => {
				navigate("/login", { replace: true, state: { passwordReset: true } });
			}, 2000);
		} catch (err) {
			const status = err?.response?.status;
			const msg = getApiErrorMessage(err, "Failed to reset password. Please try again.");

			setGlobalError(msg);

			if (status === 400 || status === 422) {
				const apiErrors = err?.response?.data?.errors;
				if (apiErrors && typeof apiErrors === "object") {
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
				gap: 2,
				width: "100%",
				mt: 1,
			}}
		>
			{successMessage && (
				<Alert
					severity="success"
					sx={{
						textAlign: "left",
						"& .MuiAlert-message": {
							width: "100%",
						},
					}}
				>
					<Typography variant="body2" fontWeight={500} mb={0.5}>
						Password Reset Successful
					</Typography>
					<Typography variant="body2">{successMessage}</Typography>
					<Typography variant="body2" sx={{ mt: 1 }}>
						Redirecting to login...
					</Typography>
				</Alert>
			)}

			{globalError && (
				<Alert
					severity="error"
					sx={{
						textAlign: "left",
					}}
					onClose={() => setGlobalError("")}
				>
					{globalError}
				</Alert>
			)}

			<TextField
				name="newPassword"
				label="New Password"
				type={showPassword ? "text" : "password"}
				variant="outlined"
				value={formData.newPassword}
				onChange={handleChange}
				error={!!errors.newPassword}
				helperText={errors.newPassword || "Must be at least 8 characters"}
				disabled={submitting || !!successMessage}
				InputLabelProps={{ sx: { color: theme.palette.text.secondary } }}
				InputProps={{
					endAdornment: (
						<InputAdornment position="end">
							<IconButton
								aria-label="toggle password visibility"
								onClick={() => setShowPassword(!showPassword)}
								edge="end"
							>
								{showPassword ? <VisibilityOff /> : <Visibility />}
							</IconButton>
						</InputAdornment>
					),
				}}
				sx={{
					"& .MuiOutlinedInput-root": {
						"&:hover fieldset": {
							borderColor: theme.palette.primary.main,
						},
					},
				}}
				autoFocus
			/>

			<TextField
				name="confirmPassword"
				label="Confirm New Password"
				type={showConfirmPassword ? "text" : "password"}
				variant="outlined"
				value={formData.confirmPassword}
				onChange={handleChange}
				error={!!errors.confirmPassword}
				helperText={errors.confirmPassword}
				disabled={submitting || !!successMessage}
				InputLabelProps={{ sx: { color: theme.palette.text.secondary } }}
				InputProps={{
					endAdornment: (
						<InputAdornment position="end">
							<IconButton
								aria-label="toggle password visibility"
								onClick={() => setShowConfirmPassword(!showConfirmPassword)}
								edge="end"
							>
								{showConfirmPassword ? <VisibilityOff /> : <Visibility />}
							</IconButton>
						</InputAdornment>
					),
				}}
				sx={{
					"& .MuiOutlinedInput-root": {
						"&:hover fieldset": {
							borderColor: theme.palette.primary.main,
						},
					},
				}}
			/>

			<AtlasButton
				type="submit"
				variant="contained"
				loading={submitting}
				loadingPosition="center"
				disabled={!!successMessage}
				sx={{
					mt: 2,
					py: 1.2,
					fontWeight: 600,
					borderRadius: theme.shape.borderRadius,
					backgroundColor: theme.palette.primary.main,
					"&:hover": { backgroundColor: theme.palette.primary.dark },
				}}
			>
				{successMessage ? "Redirecting..." : "Reset Password"}
			</AtlasButton>
		</Box>
	);
}
