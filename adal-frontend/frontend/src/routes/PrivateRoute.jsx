import { Navigate } from "react-router-dom"
import { getAccessToken } from "../utils/tokenStorage"
import { isTokenValid } from "../utils/tokenValidation"

export default function PrivateRoute({children}) {
    const access = getAccessToken();
    const isAuthenticated = access ? isTokenValid(access) : false;
    return isAuthenticated ? children : <Navigate to="/login" replace />;
}
