import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'POS SalApp',
    short_name: 'SalApp',
    description: 'Point of Sale for Pondok Pesantren',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f4f5',
    theme_color: '#09090b',
    orientation: 'portrait',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/window.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      }
    ],
  }
}
