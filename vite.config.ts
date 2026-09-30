import {defineConfig,type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

// Content Security Policy for the published site (build only; the dev server needs inline scripts).
// Scripts only from this site; images, frames and fetches limited to the few hosts the pages use.
export const CSP=[
 "default-src 'self'",
 "script-src 'self'",
 "style-src 'self' 'unsafe-inline'",
 "img-src 'self' data: https://i.ytimg.com https://assets.st-note.com",
 "font-src 'self' data:",
 "connect-src 'self'",
 "frame-src https://www.youtube-nocookie.com https://platform.twitter.com",
 "object-src 'none'",
 "base-uri 'self'",
 "form-action 'none'",
 'upgrade-insecure-requests',
].join('; ');
const csp=():Plugin=>({name:'sakiyomi-csp',apply:'build',transformIndexHtml:html=>html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="referrer" content="strict-origin-when-cross-origin">`)});

export default defineConfig({base:'/limited-forecast-pages/',plugins:[react(),csp()],resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}}});
