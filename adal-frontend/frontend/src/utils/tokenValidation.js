/**
 * Token validation utilities for frontend
 * Validates JWT tokens without making API calls
 */
import logger from "./logger";

/**
 * Decode JWT token without verification (client-side only)
 * Note: This does not verify the signature, only checks expiry
 * Backend should always verify the signature
 */
export const decodeToken = (token) => {
  if (!token) return null;
  
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    logger.error('Token decode error:', error);
    return null;
  }
};

/**
 * Check if a token is expired
 * @param {string} token - JWT token
 * @returns {boolean} - True if token is expired or invalid, false if valid
 */
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  
  // exp is in seconds, convert to milliseconds for Date comparison
  const expirationTime = payload.exp * 1000;
  const currentTime = Date.now();
  
  return currentTime >= expirationTime;
};

/**
 * Check if a token is valid (exists and not expired)
 * @param {string} token - JWT token
 * @returns {boolean} - True if token is valid, false otherwise
 */
export const isTokenValid = (token) => {
  if (!token) return false;
  return !isTokenExpired(token);
};

/**
 * Get token expiry time
 * @param {string} token - JWT token
 * @returns {Date|null} - Expiry date or null if invalid
 */
export const getTokenExpiry = (token) => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return null;
  
  return new Date(payload.exp * 1000);
};

/**
 * Get time until token expires
 * @param {string} token - JWT token
 * @returns {number|null} - Milliseconds until expiry or null if invalid
 */
export const getTimeUntilExpiry = (token) => {
  const expiry = getTokenExpiry(token);
  if (!expiry) return null;
  
  return expiry.getTime() - Date.now();
};

export default {
  decodeToken,
  isTokenExpired,
  isTokenValid,
  getTokenExpiry,
  getTimeUntilExpiry,
};
