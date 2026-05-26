import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import ThemeRegistry from '@/components/ThemeRegistry';
import './globals.css';

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
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <ThemeRegistry>{children}</ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
