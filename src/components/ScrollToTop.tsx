import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Every page change starts at the top of the new page. Links to a section
// (/profile#community) scroll to that section instead. Query-only changes
// (filters, in-page tabs) keep the reader where they are.
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // wait a frame so lazily loaded pages have rendered the target
      const id = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 50);
      return () => window.clearTimeout(id);
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}
