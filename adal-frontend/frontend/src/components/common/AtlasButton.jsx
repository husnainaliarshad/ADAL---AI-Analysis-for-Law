import React, { forwardRef } from "react";
import PropTypes from "prop-types";
import { Button, CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

/**
 * AtlasButton
 * A theme-aware wrapper around MUI Button with:
 * - Loading state (spinner in start/end/center)
 * - Optional routing (via `to` -> react-router Link)
 * - Consistent defaults (radius, weight, no transform)
 */
const AtlasButton = forwardRef(function AtlasButton(
	{
		children,
		variant = "contained",
		color = "primary",
		size = "medium",
		fullWidth = false,
		startIcon,
		endIcon,
		loading = false,
		loadingPosition = "start",
		disabled,
		to,
		href,
		type = "button",
		sx,
		...props
	},
	ref
){
	const theme = useTheme();

	const isCenter = loading && loadingPosition === "center";
	const isStart = loading && loadingPosition === "start";
	const isEnd = loading && loadingPosition === "end";

	const contentOpacity = isCenter ? 0.0 : 1.0;

	// Decide component for routing if `to` provided
	const routingProps = to ? { component: RouterLink, to } : {};

	return (
		<Button
			ref={ref}
			type={type}
			variant={variant}
			color={color}
			size={size}
			fullWidth={fullWidth}
			disabled={disabled || loading}
			startIcon={isStart ? <CircularProgress size={18} color="inherit" /> : startIcon}
			endIcon={isEnd ? <CircularProgress size={18} color="inherit" /> : endIcon}
			sx={{
				position: isCenter ? "relative" : undefined,
				borderRadius: theme.shape.borderRadius,
					fontWeight: 600,
					textTransform: "none",
					// Ensure bright text on contained buttons in both light and dark modes
					...(variant === "contained" ? { color: `${theme.palette.common.white} !important` } : {}),
						// Make outlined variant label and border stronger/clearer
						...(variant === "outlined"
							? {
									color: theme.palette.primary.main,
									borderColor: theme.palette.primary.main,
									"&:hover": {
										borderColor: theme.palette.primary.main,
										backgroundColor: theme.palette.action.hover,
									},
								}
							: {}),
				...(Array.isArray(sx) ? sx.reduce((acc, cur) => ({ ...acc, ...cur }), {}) : sx),
			}}
			aria-busy={loading ? "true" : undefined}
			{...routingProps}
			href={href}
			{...props}
		>
			{/* Center spinner overlay */}
			{isCenter && (
				<CircularProgress
					size={18}
					color="inherit"
					sx={{ position: "absolute" }}
				/>
			)}
			<span style={{ opacity: contentOpacity, color: "inherit" }}>{children}</span>
		</Button>
	);
});

AtlasButton.propTypes = {
	children: PropTypes.node,
	variant: PropTypes.oneOf(["contained", "outlined", "text"]),
	color: PropTypes.string,
	size: PropTypes.oneOf(["small", "medium", "large"]),
	fullWidth: PropTypes.bool,
	startIcon: PropTypes.node,
	endIcon: PropTypes.node,
	loading: PropTypes.bool,
	loadingPosition: PropTypes.oneOf(["start", "end", "center"]),
	disabled: PropTypes.bool,
	to: PropTypes.string,
	href: PropTypes.string,
	type: PropTypes.oneOf(["button", "submit", "reset"]),
	sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

export default AtlasButton;

