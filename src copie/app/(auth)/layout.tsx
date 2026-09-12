export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sand px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <svg width="30" height="30" viewBox="0 0 26 26" fill="none" aria-hidden>
            <rect width="26" height="26" rx="7" fill="#0EA5A8" />
            <path d="M8 7v12M18 7v12M8 13h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="font-display font-semibold text-lg text-ink">Health Project Hub</span>
        </div>
        {children}
      </div>
    </div>
  );
}
