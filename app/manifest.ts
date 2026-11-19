import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SecDigest: CyberSec & AI Daily Brief',
    short_name: 'SecDigest',
    description: 'Curated daily cybersecurity, cloud security, CTF, and free AI developer tools digest.',
    start_url: '/',
    display: 'standalone',
    background_color: '#E5DFD3',
    theme_color: '#E5DFD3',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'Feed',
        short_name: 'Feed',
        description: 'Open the daily security and tech digest feed.',
        url: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
      {
        name: 'Practice',
        short_name: 'Practice',
        description: 'Open daily coding and security practice.',
        url: '/practice',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    ],
  };
}
