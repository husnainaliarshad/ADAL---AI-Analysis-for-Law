import React from "react";
import { Box, Typography, Card, Link } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import EmailIcon from "@mui/icons-material/Email";
import LockResetIcon from "@mui/icons-material/LockReset";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ThemeToggleButton from "../components/ThemeToggleButton";
import ResetPasswordForm from "../components/auth/ResetPasswordForm";
import ResetPasswordTokenForm from "../components/auth/ResetPasswordTokenForm";

export default function ResetPassword() {
	const theme = useTheme();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const token = searchParams.get("token");
	const isTokenMode = Boolean(token);

	return (
		<Box
			sx={{
				display: "flex",
				flexDirection: { xs: "column", md: "row" },
				minHeight: "100vh",
				width: "100%",
				backgroundColor: theme.palette.background.default,
				color: theme.palette.text.primary,
				transition: "background-color 0.3s ease",
				position: "relative",
				overflowX: "hidden",
			}}
		>
			{/* Left Section - Branding */}
			<Box
				sx={{
					flex: 1,
					bgcolor: theme.palette.background.paper,
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					px: { xs: 4, md: 8 },
					py: { xs: 4, md: 0 },
				}}
			>
				<Motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
				>
					<Typography variant="h6" color="primary" fontWeight={700} mb={4}>
						ADAL
					</Typography>

					<Typography
						variant="h3"
						color="primary"
						fontWeight={700}
						sx={{
							lineHeight: 1.2,
							mb: 2,
							[theme.breakpoints.down("sm")]: { fontSize: "2.2rem" },
						}}
					>
						{isTokenMode ? "Set your new password" : "Reset your password"}
					</Typography>

					<Typography variant="h5" color="text.secondary" fontWeight={600} mb={3}>
						{isTokenMode
							? "Enter your new password below"
							: "No worries, we'll help you get back in"}
					</Typography>

					<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 4 }}>
						<Link
							component="button"
							onClick={() => navigate("/login")}
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 1,
								color: theme.palette.text.secondary,
								textDecoration: "none",
								cursor: "pointer",
								"&:hover": {
									color: theme.palette.primary.main,
								},
							}}
						>
							<ArrowBackIcon fontSize="small" />
							<Typography variant="body2" fontWeight={500}>
								Back to login
							</Typography>
						</Link>
					</Box>
				</Motion.div>
			</Box>

			{/* Right Section - Form */}
			<Box
				sx={{
					flex: 1,
					bgcolor: theme.palette.background.default,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					p: { xs: 2, sm: 3 },
					overflowY: "auto",
				}}
			>
				<Motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, delay: 0.1 }}
				>
					<Card
						sx={{
							p: { xs: 3, sm: 4, md: 5 },
							borderRadius: theme.shape.borderRadius,
							backgroundColor: theme.palette.background.paper,
							boxShadow: theme.shadows[4],
							width: "100%",
							maxWidth: 420,
							textAlign: "center",
						}}
					>
						{/* Icon */}
						<Box
							sx={{
								display: "flex",
								justifyContent: "center",
								mb: 3,
							}}
						>
							<Box
								sx={{
									width: 64,
									height: 64,
									borderRadius: "50%",
									backgroundColor: theme.palette.primary.light,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: theme.palette.primary.main,
								}}
							>
								{isTokenMode ? (
									<LockResetIcon sx={{ fontSize: 32 }} />
								) : (
									<EmailIcon sx={{ fontSize: 32 }} />
								)}
							</Box>
						</Box>

						<Typography variant="h5" fontWeight={700} mb={1}>
							{isTokenMode ? "Create New Password" : "Forgot your password?"}
						</Typography>

						<Typography variant="body2" color="text.secondary" mb={3}>
							{isTokenMode
								? "Please enter your new password. Make sure it's strong and secure."
								: "Enter your email address and we'll send you a link to reset your password."}
						</Typography>

						{isTokenMode ? (
							<ResetPasswordTokenForm token={token} />
						) : (
							<ResetPasswordForm />
						)}

						<Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
							Remembered your password?{" "}
							<Link
								underline="hover"
								sx={{
									color: theme.palette.primary.main,
									cursor: "pointer",
									fontWeight: 500,
								}}
								onClick={() => navigate("/login")}
							>
								Sign in
							</Link>
						</Typography>
					</Card>
				</Motion.div>
			</Box>

			{/* Floating Theme Toggle */}
			<Box sx={{ position: "fixed", bottom: 16, right: 16, zIndex: 1000 }}>
				<ThemeToggleButton />
			</Box>
		</Box>
	);
}
