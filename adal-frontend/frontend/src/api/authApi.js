// Authentication API wrapper for ADAL frontend
// Uses the shared axiosClient so baseURL, headers, and tokens are handled centrally
// Each method returns the Axios Promise for flexible usage with .then() or await

import axiosClient from './axiosClient'
import { getRefreshToken } from '../utils/tokenStorage'
import logger from '../utils/logger'

// Tiny helper to log useful error info then rethrow so callers can handle it
const logAndRethrow = (label, error) => {
	const status = error?.response?.status || null
	const data = error?.response?.data || null
	const url = error?.config?.url || null
	logger.error(`[authApi] ${label} error:`, { message: error?.message, status, url, data })
	throw error
}

// Detects FormData to set appropriate content type when needed
const withContentType = (data) => (
	typeof FormData !== 'undefined' && data instanceof FormData
		? { headers: { 'Content-Type': 'multipart/form-data' } }
		: undefined
)

const authApi = {
	// Register a new user (name, email, password, etc.)
	// Accepts JSON or FormData. Returns Axios Promise.
	register: (data) =>
		axiosClient
			.post('/auth/register', data, withContentType(data))
			.catch((err) => logAndRethrow('register', err)),

	// Login with user credentials (email, password). Returns JWT token in response.
	login: (data) =>
		axiosClient
			.post('/auth/login', data)
			.catch((err) => logAndRethrow('login', err)),

	// Logout current session/token (server invalidation). No request body.
	logout: () =>
		axiosClient
			.post('/auth/logout')
			.catch((err) => logAndRethrow('logout', err)),

	// Get current user's profile. Requires Authorization header (added by axiosClient).
	getProfile: () =>
		axiosClient
			.get('/auth/profile')
			.catch((err) => logAndRethrow('getProfile', err)),

	// Update profile info (e.g., name, email). Supports JSON or FormData (for avatar uploads, etc.).
	updateProfile: (data) =>
		axiosClient
			.put('/auth/profile', data, withContentType(data))
			.catch((err) => logAndRethrow('updateProfile', err)),

	// Change password for authenticated users. Typical shape: { currentPassword, newPassword }
	changePassword: (data) =>
		axiosClient
			.post('/auth/change-password', data)
			.catch((err) => logAndRethrow('changePassword', err)),

	// Request password reset. Sends reset link to email. Typical shape: { email }
	requestPasswordReset: (data) =>
		axiosClient
			.post('/auth/request-password-reset', data)
			.catch((err) => logAndRethrow('requestPasswordReset', err)),

	// Reset password with token from email. Typical shape: { token, newPassword }
	resetPassword: (data) =>
		axiosClient
			.post('/auth/reset-password', data)
			.catch((err) => logAndRethrow('resetPassword', err)),

	// Refresh access token using a refresh token. Returns new tokens.
	// Accepts an optional refreshToken parameter. If omitted, will try
	// to read the canonical localStorage key: 'refreshToken'.
	refreshToken: (refreshToken) => {
		try {
			let payload
			if (refreshToken) {
				payload = { refreshToken }
			} else {
				const stored = getRefreshToken()
				if (!stored) {
					return Promise.reject(new Error('No refresh token available'))
				}
				payload = { refreshToken: stored }
			}

			// Adjust path if backend differs (e.g., '/auth/refresh-token')
			return axiosClient.post('/auth/refresh', payload).catch((err) => logAndRethrow('refreshToken', err))
		} catch (err) {
			return Promise.reject(err)
		}
	},
}

export default authApi
