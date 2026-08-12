import { Loader2 } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <img src="/logo.jpg" alt="Logo" className="h-12 w-12 rounded-2xl object-cover shadow-lg" />
        <Spinner className="h-5 w-5 text-navy-600" />
      </div>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}
