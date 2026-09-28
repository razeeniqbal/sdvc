import { Loader2 } from 'lucide-react';
import { VsbLogo } from '@/components/VsbLogo';

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink">
      <div className="flex flex-col items-center gap-4">
        <VsbLogo variant="mark" className="h-8" />
        <Spinner className="h-5 w-5 text-vsb-500" />
      </div>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}
