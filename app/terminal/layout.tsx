import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '3 Index Terminal | Advanced Market Analysis',
  description: 'Institutional-grade real-time market quality analysis, technical indicators, and AI-powered assessments for professional traders.',
};

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
