import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Resume Builder — AI-Powered ATS Resume Optimizer',
  description:
    'Paste your resume and a job description. Our AI rewrites your resume to pass ATS, highlights skill gaps, and generates a tailored cover letter — all in seconds.',
  keywords: [
    'resume builder',
    'AI resume',
    'ATS optimizer',
    'cover letter generator',
    'job description tailoring',
    'Claude AI',
    'GPT-4o',
  ],
  authors: [{ name: 'Resume Builder' }],
  openGraph: {
    title: 'Resume Builder — AI-Powered ATS Resume Optimizer',
    description:
      'Transform your resume to match any job description with AI. ATS-optimized, gap analysis included.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
