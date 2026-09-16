import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Accessibility CI/CD Platform',
  description: 'Automated Accessibility Scans and Compliance Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          padding: 0,
          backgroundColor: '#0f172a',
          color: '#f8fafc',
        }}
      >
        {children}
      </body>
    </html>
  );
}
