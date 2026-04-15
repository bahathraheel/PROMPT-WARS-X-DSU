import './globals.css';

export const metadata = {
  title: 'SICHER | Safety-First Navigation',
  description: 'Find the safest walking routes. SICHER analyzes lighting, foot traffic, CCTV, and emergency proximity to guide you securely.',
  keywords: 'navigation, safe route, walking, security, mapbox, routing',
  authors: [{ name: 'Antigravity' }],
  openGraph: {
    title: 'SICHER — Safety-First Navigation',
    description: 'Find the safest walking route to your destination.',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#06060c',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Accessibility: Skip Links */}
        <a href="#search-input" className="skip-link">Skip to search</a>
        <a href="#map-region" className="skip-link" style={{ left: '180px' }}>Skip to map</a>
        <a href="#route-results" className="skip-link" style={{ left: '340px' }}>Skip to results</a>
        {children}
      </body>
    </html>
  );
}
