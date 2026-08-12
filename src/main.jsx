import { createRoot } from 'react-dom/client';

import App from './App.jsx';

/*
  Deliberately not wrapped in StrictMode.

  The app owns a single WebGL context, a PMREM probe and a global
  ScrollTrigger. StrictMode's double-invoked effects would build and
  tear all of that down twice on every mount in development, which
  costs a second of GPU work and makes the loading progress lie.
  The mount effect is written to clean up properly regardless.
*/
createRoot(document.getElementById('root')).render(<App />);
