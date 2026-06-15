// Helper functions: pure, reusable utilities used across the app.
// Keep this file framework-agnostic and dependency-free.

import { UPLOAD } from "./constants";

// ----- Number & string formatting -----

/**
 * Format bytes to human-readable string (e.g., 1.23 MB)
 */
export function formatBytes(bytes, decimals = 2) {
	if (!Number.isFinite(bytes)) return "-";
	if (bytes === 0) return "0 B";
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
	const val = bytes / Math.pow(k, i);
	return `${val.toFixed(dm)} ${sizes[i]}`;
}

/** Title Case a string */
export function toTitleCase(str) {
	if (!str) return "";
	return String(str)
		.toLowerCase()
		.split(/\s+/)
		.map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
		.join(" ");
}

/** Pluralize based on count */
export function pluralize(word, count, plural = `${word}s`) {
	return `${count} ${count === 1 ? word : plural}`;
}

// ----- Dates & time -----

export function formatDate(date, options) {
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d)) return "-";
	const locale = typeof navigator !== "undefined" ? navigator.language : "en-US";
	const fmt = new Intl.DateTimeFormat(locale, options || { year: "numeric", month: "short", day: "2-digit" });
	return fmt.format(d);
}

/**
 * Rough relative date (e.g., "2d ago").
 */
export function formatRelativeDate(date) {
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d)) return "-";
	const diffMs = d.getTime() - Date.now();
	const abs = Math.abs(diffMs);
	const minutes = Math.round(abs / 60000);
	const hours = Math.round(abs / 3600000);
	const days = Math.round(abs / 86400000);
	const rtf = new Intl.RelativeTimeFormat(typeof navigator !== "undefined" ? navigator.language : "en-US", { numeric: "auto" });
	if (minutes < 60) return rtf.format(Math.sign(diffMs) * minutes, "minute");
	if (hours < 24) return rtf.format(Math.sign(diffMs) * hours, "hour");
	return rtf.format(Math.sign(diffMs) * days, "day");
}

// ----- Arrays & objects -----

export function clamp(num, min, max) {
	return Math.min(Math.max(num, min), max);
}

export function uniqueBy(arr, keyFn) {
	const seen = new Set();
	const out = [];
	for (const item of arr || []) {
		const key = keyFn(item);
		if (!seen.has(key)) {
			seen.add(key);
			out.push(item);
		}
	}
	return out;
}

export function pick(obj, keys) {
	const out = {};
	for (const k of keys || []) if (k in obj) out[k] = obj[k];
	return out;
}

export function omit(obj, keys) {
	const set = new Set(keys || []);
	const out = {};
	for (const k in obj) if (!set.has(k)) out[k] = obj[k];
	return out;
}

/** Remove empty values from an object */
export function cleanObject(obj, opts = {}) {
	const { removeNull = true, removeUndefined = true, removeEmptyString = true, deep = false } = opts;
	const out = Array.isArray(obj) ? [] : {};
	for (const [k, v] of Object.entries(obj || {})) {
		let val = v;
		if (deep && val && typeof val === "object") val = cleanObject(val, opts);
		if (removeUndefined && typeof val === "undefined") continue;
		if (removeNull && val === null) continue;
		if (removeEmptyString && val === "") continue;
		if (Array.isArray(out)) out.push(val);
		else out[k] = val;
	}
	return out;
}

// ----- URLs & query strings -----

/** Build a query string from an object (skips null/undefined) */
export function buildQueryString(params = {}) {
	const usp = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v === null || v === undefined || v === "") continue;
		if (Array.isArray(v)) v.forEach((x) => usp.append(k, String(x)));
		else usp.set(k, String(v));
	}
	const qs = usp.toString();
	return qs ? `?${qs}` : "";
}

// ----- Local storage (safe) -----

export const safeLocalStorage = {
	get(key, fallback = null) {
		try {
			const raw = localStorage.getItem(key);
			if (raw == null) return fallback;
			try {
				return JSON.parse(raw);
			} catch {
				return raw;
			}
		} catch {
			return fallback;
		}
	},
	set(key, value) {
		try {
			const raw = typeof value === "string" ? value : JSON.stringify(value);
			localStorage.setItem(key, raw);
			return true;
		} catch {
			return false;
		}
	},
	remove(key) {
		try {
			localStorage.removeItem(key);
			return true;
		} catch {
			return false;
		}
	},
};

// ----- Timing helpers -----

export function debounce(fn, wait = 300) {
	let t;
	return function debounced(...args) {
		clearTimeout(t);
		t = setTimeout(() => fn.apply(this, args), wait);
	};
}

export function throttle(fn, wait = 300) {
	let last = 0;
	let timer = null;
	return function throttled(...args) {
		const now = Date.now();
		const remaining = wait - (now - last);
		if (remaining <= 0) {
			clearTimeout(timer);
			timer = null;
			last = now;
			fn.apply(this, args);
		} else if (!timer) {
			timer = setTimeout(() => {
				last = Date.now();
				timer = null;
				fn.apply(this, args);
			}, remaining);
		}
	};
}

export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ----- Files -----

export function getFileExtension(name = "") {
	const idx = name.lastIndexOf(".");
	return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function isMimeAllowed(mime, allowed = UPLOAD.ALLOWED_MIME_TYPES) {
	if (!mime) return false;
	return allowed.some((pattern) => {
		if (pattern.endsWith("/*")) {
			const group = pattern.split("/")[0];
			return mime.startsWith(`${group}/`);
		}
		return pattern === mime;
	});
}

export function isAllowedFile(file, opts = {}) {
	const { types = UPLOAD.ALLOWED_MIME_TYPES, maxSizeMb = UPLOAD.MAX_UPLOAD_MB } = opts;
	const sizeOk = typeof file.size === "number" ? file.size <= maxSizeMb * 1024 * 1024 : true;
	
	// Check MIME type first
	let typeOk = isMimeAllowed(file.type, types);
	
	// Fallback to extension check if MIME type check fails
	// This handles cases where browsers report inconsistent MIME types (e.g., .md files as text/plain)
	if (!typeOk) {
		const ext = getFileExtension(file.name);
		const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'md', 'markdown', 'txt'];
		typeOk = allowedExtensions.includes(ext.toLowerCase());
	}
	
	return { ok: sizeOk && typeOk, sizeOk, typeOk };
}

export function createFormData(fields = {}, files = []) {
	const fd = new FormData();
	// append fields
	for (const [k, v] of Object.entries(fields)) {
		if (v === null || v === undefined) continue;
		if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
		else fd.append(k, v);
	}
	// append files (accepts FileList or array)
	const arr = Array.from(files);
	arr.forEach((f) => fd.append("files", f));
	return fd;
}

export function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

// ----- Sorting helpers -----

export function compareBy(key, dir = "asc") {
	const factor = dir === "desc" ? -1 : 1;
	return (a, b) => {
		const va = a?.[key];
		const vb = b?.[key];
		if (va == null && vb == null) return 0;
		if (va == null) return -1 * factor;
		if (vb == null) return 1 * factor;
		if (va < vb) return -1 * factor;
		if (va > vb) return 1 * factor;
		return 0;
	};
}

export function compareByAccessor(accessor, dir = "asc") {
	const factor = dir === "desc" ? -1 : 1;
	return (a, b) => {
		const va = accessor(a);
		const vb = accessor(b);
		if (va == null && vb == null) return 0;
		if (va == null) return -1 * factor;
		if (vb == null) return 1 * factor;
		if (va < vb) return -1 * factor;
		if (va > vb) return 1 * factor;
		return 0;
	};
}

// ----- Backend-adjacent placeholders -----
// Implement in your API layer using axios/fetch; helpers are provided for data prep only.

/** Example: build document list params */
export function buildDocumentListParams({ q, type, status, page, pageSize } = {}) {
	return cleanObject({ q, type, status, page, pageSize });
}

export default {
	formatBytes,
	toTitleCase,
	pluralize,
	formatDate,
	formatRelativeDate,
	clamp,
	uniqueBy,
	pick,
	omit,
	cleanObject,
	buildQueryString,
	safeLocalStorage,
	debounce,
	throttle,
	sleep,
	getFileExtension,
	isMimeAllowed,
	isAllowedFile,
	createFormData,
	fileToBase64,
	compareBy,
	compareByAccessor,
	buildDocumentListParams,
};

