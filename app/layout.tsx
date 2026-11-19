import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import BottomNav from '@/components/BottomNav';
import RegisterServiceWorker from '@/components/RegisterServiceWorker';

// Runs before first paint: applies the saved reading theme to the body so dusk
// users never see a paper-colored flash on load. Kept tiny and dependency-free.
const themeInitScript = `(function(){try{var t=localStorage.getItem('secdigest_theme');if(t==='dusk'){document.body.style.backgroundColor='#1E1B29';document.body.style.color='#EAE6F2';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','#1E1B29');}}catch(e){}})();`;

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
    <html lang="en">
      {/* The theme script below sets body styles before hydration; that difference is expected. */}
      <body className="min-h-screen font-sans antialiased transition-colors duration-200" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>
          {children}
          <BottomNav />
        </Providers>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
