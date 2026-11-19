import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import BottomNav from '@/components/BottomNav';
import RegisterServiceWorker from '@/components/RegisterServiceWorker';

// Runs before first paint: sets html[data-theme] and paints the body dark for
// dusk users while CSS keeps #__app hidden until client theme state is applied.
// Includes a 1500ms fallback so content can never remain hidden.
const themeInitScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('secdigest_theme')==='dusk'?'dusk':'paper';d.dataset.theme=t;if(t==='dusk'){document.body.style.backgroundColor='#1E1B29';document.body.style.color='#EAE6F2';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','#1E1B29');setTimeout(function(){if(!d.dataset.themeReady)d.dataset.themeReady='1';},1500);}}catch(e){d.dataset.theme='paper';d.dataset.themeReady='1';}})();`;

export const metadata: Metadata = {
  title: 'SecDigest | CyberSec & Tech Intelligence',
  description: 'Daily curated cyber security, cloud security, CTFs, and AI intelligence for fast morning reading.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SecDigest',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: { url: '/icon-192.png', type: 'image/png' },
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#E5DFD3',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* The theme script below sets html data-theme and body styles before hydration; that difference is expected. */}
      <body className="min-h-screen font-sans antialiased transition-colors duration-200" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <noscript
          dangerouslySetInnerHTML={{
            __html: '<style>#__app{visibility:visible!important}</style>',
          }}
        />
        <div id="__app">
          <Providers>
            {children}
            <BottomNav />
          </Providers>
        </div>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
