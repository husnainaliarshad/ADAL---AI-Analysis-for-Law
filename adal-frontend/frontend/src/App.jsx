// src/App.jsx
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes";
import { CaseProvider } from "./contexts/CaseContext";

export default function App() {
  return (
    <BrowserRouter>
      <CaseProvider>
        <AppRoutes />
      </CaseProvider>
    </BrowserRouter>
  );
}
