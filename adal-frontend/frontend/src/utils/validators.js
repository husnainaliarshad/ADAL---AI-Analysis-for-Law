// Validation utilities: pure functions that validate inputs and return structured results.
// Keep dependency-free and reuse constants/helpers for consistency.

import { UPLOAD, PAGINATION } from "./constants";
import { isMimeAllowed } from "./helpers";

// ----- Primitive validators -----

export function isNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0;
}

export function hasMinLength(value, min) {
	if (typeof value !== "string") return false;
	return value.trim().length >= min;
}

export function hasMaxLength(value, max) {
	if (typeof value !== "string") return false;
	return value.trim().length <= max;
}

export function isEmail(email) {
	if (typeof email !== "string") return false;
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
	return re.test(email.trim());
}

/**
 * Validate password strength.
 * Options: { minLength, requireUpper, requireLower, requireNumber, requireSymbol }
 */
export function validatePassword(password, opts = {}) {
	const {
		minLength = 8,
		requireUpper = true,
		requireLower = true,
		requireNumber = true,
		requireSymbol = true,
	} = opts;

	const errors = [];
	const s = typeof password === "string" ? password : "";
	if (s.length < minLength) errors.push(`Must be at least ${minLength} characters`);
	if (requireUpper && !/[A-Z]/.test(s)) errors.push("At least one uppercase letter");
	if (requireLower && !/[a-z]/.test(s)) errors.push("At least one lowercase letter");
	if (requireNumber && !/[0-9]/.test(s)) errors.push("At least one number");
		// Any non-alphanumeric character counts as a symbol
		if (requireSymbol && !/[^A-Za-z0-9]/.test(s)) errors.push("At least one symbol");
	return { ok: errors.length === 0, errors };
}

// ----- Domain-specific validators -----

export function validateTitle(title, { min = 1, max = 120 } = {}) {
	const errors = [];
	if (!isNonEmptyString(title)) errors.push("Title is required");
	if (!hasMinLength(title || "", min)) errors.push(`Title must be at least ${min} characters`);
	if (!hasMaxLength(title || "", max)) errors.push(`Title must be at most ${max} characters`);
	return { ok: errors.length === 0, errors };
}

export function parseTags(input) {
	if (!input) return [];
	return String(input)
		.split(/[,\n]/)
		.map((t) => t.trim())
		.filter(Boolean);
}

export function validateTags(input, { maxCount = 20, maxLength = 24 } = {}) {
	const tags = Array.isArray(input) ? input : parseTags(input);
	const errors = [];
	if (tags.length > maxCount) errors.push(`No more than ${maxCount} tags`);
	const tooLong = tags.find((t) => t.length > maxLength);
	if (tooLong) errors.push(`Tag '${tooLong}' exceeds ${maxLength} characters`);
	return { ok: errors.length === 0, errors, tags };
}

// ----- File validators -----

export function validateMimeType(mime, allowed = UPLOAD.ALLOWED_MIME_TYPES) {
	return isMimeAllowed(mime, allowed);
}

export function validateFileSize(file, maxSizeMb = UPLOAD.MAX_UPLOAD_MB) {
	const sizeOk = typeof file?.size === "number" ? file.size <= maxSizeMb * 1024 * 1024 : false;
	return sizeOk;
}

export function validateFile(file, opts = {}) {
	const { types = UPLOAD.ALLOWED_MIME_TYPES, maxSizeMb = UPLOAD.MAX_UPLOAD_MB } = opts;
	const errors = [];
	if (!file) errors.push("No file provided");
	if (file && !validateMimeType(file.type, types)) errors.push("File type is not allowed");
	if (file && !validateFileSize(file, maxSizeMb)) errors.push(`File exceeds ${maxSizeMb} MB`);
	return { ok: errors.length === 0, errors };
}

export function validateFiles(files, opts = {}) {
	const arr = Array.from(files || []);
	const results = arr.map((f) => ({ file: f, ...validateFile(f, opts) }));
	const ok = results.every((r) => r.ok);
	return { ok, results };
}

export function validateFileCount(currentCount, incomingCount, maxFiles = UPLOAD.MAX_FILES) {
	const total = currentCount + incomingCount;
	return { ok: total <= maxFiles, total, overflow: Math.max(0, total - maxFiles) };
}

// ----- Pagination -----

export function validatePagination({ page, pageSize }) {
	const errors = [];
	const p = Number.isFinite(page) ? page : 0;
	const ps = Number.isFinite(pageSize) ? pageSize : PAGINATION.DEFAULT_PAGE_SIZE;
	if (p < 0) errors.push("Page cannot be negative");
	if (!PAGINATION.PAGE_SIZES.includes(ps)) errors.push("Invalid page size");
	return { ok: errors.length === 0, errors, page: Math.max(0, p), pageSize: ps };
}

// ----- Auth field validators -----

export function validateEmailField(email) {
	const errors = [];
	if (!isNonEmptyString(email)) errors.push("Email is required");
	else if (!isEmail(email)) errors.push("Enter a valid email address");
	return { ok: errors.length === 0, errors };
}

export function validatePasswordField(password, opts) {
	const res = validatePassword(password, opts);
	if (!isNonEmptyString(password)) res.errors.unshift("Password is required");
	return { ok: res.errors.length === 0, errors: res.errors };
}

export default {
	// primitives
	isNonEmptyString,
	hasMinLength,
	hasMaxLength,
	isEmail,
	validatePassword,
	// domain
	validateTitle,
	parseTags,
	validateTags,
	// files
	validateMimeType,
	validateFileSize,
	validateFile,
	validateFiles,
	validateFileCount,
	// pagination
	validatePagination,
	// auth fields
	validateEmailField,
	validatePasswordField,
};
