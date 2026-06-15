import React, { useState } from "react";
import { Box, TextField, Typography, Alert } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AtlasButton from "../common/AtlasButton";
import { validateEmailField } from "../../utils/validators";
import authApi from "../../api/authApi";
import { getApiErrorMessage } from "../../utils/errorMessage";

export default function ResetPasswordForm() {
	const theme = useTheme();

	const [formData, setFormData] = useState({
		email: "",
	});

	const [errors, setErrors] = useState({});
	const [globalError, setGlobalError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData({ ...formData, [name]: value });
		// Clear error when user starts typing
		if (errors[name]) {
			setErrors({ ...errors, [name]: "" });
		}
		if (globalError) {
			setGlobalError("");
		}
	};

	const validate = () => {
		const newErrors = {};
		const emailRes = validateEmailField(formData.email);
		if (!emailRes.ok) {
			newErrors.email = emailRes.errors[0];
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
			await authApi.requestPasswordReset({ email: formData.email });
			
			// Success - show message
			setSuccessMessage(
				`Password reset link has been sent to ${formData.email}. Please check your email.`
			);
			setFormData({ email: "" });
		} catch (err) {
			const status = err?.response?.status;
			const msg = getApiErrorMessage(err, "Failed to send reset link. Please try again.");

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
					onClose={() => setSuccessMessage("")}
				>
					<Typography variant="body2" fontWeight={500} mb={0.5}>
						Check your email
					</Typography>
					<Typography variant="body2">{successMessage}</Typography>
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
				name="email"
				label="Email Address"
				type="email"
				variant="outlined"
				value={formData.email}
				onChange={handleChange}
				error={!!errors.email}
				helperText={errors.email}
				disabled={submitting || !!successMessage}
				InputLabelProps={{ sx: { color: theme.palette.text.secondary } }}
				sx={{
					"& .MuiOutlinedInput-root": {
						"&:hover fieldset": {
							borderColor: theme.palette.primary.main,
						},
					},
				}}
				autoFocus
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
				{successMessage ? "Resend reset link" : "Send reset link"}
			</AtlasButton>

			{successMessage && (
				<Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: "center" }}>
					Didn't receive the email? Check your spam folder or{" "}
					<AtlasButton
						variant="text"
						size="small"
						onClick={handleSubmit}
						loading={submitting}
						sx={{
							minWidth: "auto",
							p: 0,
							fontSize: "inherit",
							textDecoration: "underline",
							"&:hover": {
								textDecoration: "underline",
								backgroundColor: "transparent",
							},
						}}
					>
						try again
					</AtlasButton>
					.
				</Typography>
			)}
		</Box>
	);
}
