import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import './app.css';
import './styles.css';

// The app uses HashRouter, which only ever reads the URL fragment - a
// direct link/bookmark/redirect to a bare path like "/chef" (no "#") has
// no hash for the router to match, so it silently falls through to the
// "/" route instead of erroring or going where it was meant to. The
// static/SPA-fallback server always returns this same index.html for any
// path, so normalizing here (before the router ever mounts) is the only
// place this can be caught.
const { pathname, hash, search } = window.location;
if (!hash && pathname !== '/') {
  window.location.replace(`${window.location.origin}/#${pathname}${search}`);
} else {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Failed to find the root element');

  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <React.StrictMode><LanguageProvider><App /></LanguageProvider></React.StrictMode>
  );
}
