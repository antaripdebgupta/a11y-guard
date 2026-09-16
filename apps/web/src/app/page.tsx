import React from 'react';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Accessibility CI/CD Platform
      </h1>
      <p style={{ fontSize: '1.2rem', color: '#94a3b8' }}>
        Phase 0 Scaffold Boot Verification Complete
      </p>
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem 2rem',
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          border: '1px solid #334155',
        }}
      >
        <code>Status: Operational</code>
      </div>
    </main>
  );
}
