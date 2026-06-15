import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Minimal test theme: if your app exports ThemeProvider/muiTheme, import that instead
const theme = createTheme();

export function renderWithProviders(ui, { route = '/', useMemoryRouter = false } = {}) {
  const Router = useMemoryRouter ? MemoryRouter : BrowserRouter;
  const routerProps = useMemoryRouter ? { initialEntries: [route] } : {};
  return render(
    <Router {...routerProps}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {ui}
      </ThemeProvider>
    </Router>
  );
}
export { render, screen };
export { userEvent };
