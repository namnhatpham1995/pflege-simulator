import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pflegedokumentation – Simulation',
  description:
    'Übungssimulator für die Pflegedokumentation mit fiktiven Patienten. Keine echten Patientendaten.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
