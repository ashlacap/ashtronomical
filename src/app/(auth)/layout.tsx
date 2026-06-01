import { StarBackground } from '@/components/StarBackground'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden bg-background">
      <StarBackground className="fixed inset-0 w-full h-full" />
      {/* Subtle radial glow from center */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.14 0.015 265 / 0.6) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}
