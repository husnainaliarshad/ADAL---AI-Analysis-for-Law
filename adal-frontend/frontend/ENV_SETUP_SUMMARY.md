# Environment Configuration Summary

**Date:** 2025-01-30  
**Status:** ✅ Complete

---

## Files Created/Updated

### ✅ 1. `env.example` (Improved)

**Improvements Made:**
- ✅ Comprehensive documentation with clear sections
- ✅ Detailed comments explaining each variable
- ✅ Usage examples for different environments
- ✅ Security warnings for production
- ✅ Examples for Development, Production, Docker, and Staging
- ✅ Notes about Vite environment variable requirements
- ✅ Instructions for setup and usage

**Key Sections:**
- API Configuration (with examples)
- Application Environment
- Development & Testing Options
- Optional Feature Flags (for future use)
- Environment-Specific Examples

### ✅ 2. `.env` (Created)

**Configuration:**
```env
VITE_API_BASE_URL=http://localhost:9006
VITE_API_URL=http://localhost:9006/api
VITE_ENV=development
VITE_ENABLE_DEV_ROUTES=false
```

**Status:** Ready for development use

---

## Environment Variables Reference

### Required Variables

| Variable | Purpose | Used By | Default |
|----------|---------|---------|---------|
| `VITE_API_BASE_URL` | Backend base URL (without /api) | `constants.js` | `http://localhost:9006` |
| `VITE_API_URL` | Full API URL (with /api) | `axiosClient.js` | `http://localhost:9006/api` |

### Optional Variables

| Variable | Purpose | Used By | Default |
|----------|---------|---------|---------|
| `VITE_ENV` | Application environment | General config | `development` |
| `VITE_ENABLE_DEV_ROUTES` | Enable dev routes in production | `routes/index.jsx` | `false` |

---

## Current Configuration

### Development Setup

Your `.env` file is configured for **local development**:

```env
VITE_API_BASE_URL=http://localhost:9006
VITE_API_URL=http://localhost:9006/api
VITE_ENV=development
VITE_ENABLE_DEV_ROUTES=false
```

**This means:**
- ✅ Frontend will connect to backend on `http://localhost:9006`
- ✅ API calls will go to `http://localhost:9006/api`
- ✅ Development mode is enabled
- ✅ Dev routes are disabled (secure)

---

## Next Steps

### 1. Verify Backend is Running

Make sure your backend server is running on port 9006:

```bash
# Check if backend is running
curl http://localhost:9006/api/files/

# Should return JSON response or 200 OK
```

### 2. Restart Frontend Dev Server

After creating/updating `.env`, restart the dev server:

```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

### 3. Test Configuration

1. Open browser DevTools (F12)
2. Navigate to Network tab
3. Go to `/documents` page
4. Verify requests go to `http://localhost:9006/api/files/`

---

## Environment-Specific Configurations

### Development (Current)
```env
VITE_API_BASE_URL=http://localhost:9006
VITE_API_URL=http://localhost:9006/api
VITE_ENV=development
VITE_ENABLE_DEV_ROUTES=false
```

### Production
```env
VITE_API_BASE_URL=https://api.adal.legal
VITE_API_URL=https://api.adal.legal/api
VITE_ENV=production
VITE_ENABLE_DEV_ROUTES=false
```

### Docker Compose
```env
VITE_API_BASE_URL=http://backend:9006
VITE_API_URL=http://backend:9006/api
VITE_ENV=development
VITE_ENABLE_DEV_ROUTES=false
```

### Staging
```env
VITE_API_BASE_URL=https://staging-api.adal.legal
VITE_API_URL=https://staging-api.adal.legal/api
VITE_ENV=staging
VITE_ENABLE_DEV_ROUTES=false
```

---

## Troubleshooting

### Issue: Environment variables not working

**Solution:**
1. Ensure variable names start with `VITE_`
2. Restart dev server after changing `.env`
3. Check `.env` file is in `frontend/` directory (not `adal-frontend/`)
4. Verify no syntax errors in `.env` file

### Issue: Wrong API URL

**Solution:**
1. Check `.env` file has correct values
2. Verify backend is running on specified port
3. Check browser console for actual API calls
4. Restart dev server

### Issue: CORS errors

**Solution:**
1. Verify backend CORS settings allow frontend origin
2. Check API URL matches backend configuration
3. Ensure backend is running

---

## Security Notes

⚠️ **Important:**
- Never commit `.env` file to git (it's in `.gitignore`)
- Always use `env.example` as a template
- Set `VITE_ENABLE_DEV_ROUTES=false` in production
- Use environment-specific configurations for different deployments

---

## File Locations

```
adal-frontend/frontend/
├── .env              ← Your actual configuration (gitignored)
├── env.example       ← Template with documentation
└── .gitignore        ← Ensures .env is not committed
```

---

## Verification Checklist

- [x] `env.example` file exists and is documented
- [x] `.env` file created with correct values
- [x] `.env` is in `.gitignore`
- [x] All required variables are set
- [x] Configuration matches backend setup
- [ ] Backend server is running on port 9006
- [ ] Frontend dev server restarted
- [ ] API connection tested

---

**Last Updated:** 2025-01-30  
**Status:** ✅ Ready for Development

