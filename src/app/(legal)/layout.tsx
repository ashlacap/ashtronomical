import Link from 'next/link'
import { AshtroIcon } from '@/components/AshtroIcon'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <AshtroIcon className="h-4 w-4" />
            <span className="font-bold text-xs tracking-[0.25em] uppercase">Ashtronomical</span>
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <article className="prose-sm space-y-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:text-sm [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_li]:text-sm [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </article>
      </main>
    </div>
  )
}
