import DOMPurify from 'dompurify';
import { useMemo } from 'react';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Renders Freshservice ticket/conversation HTML after sanitizing it. */
export function SafeHtml({ html, className = '' }: { html: string | null | undefined; className?: string }) {
  const clean = useMemo(
    () => DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button'] }),
    [html],
  );
  return <div className={`fs-html ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
