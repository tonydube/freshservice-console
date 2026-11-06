import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SafeHtml } from '../src/components/SafeHtml';

it('strips scripts and event handlers, and opens links in a new tab', () => {
  const { container } = render(
    <SafeHtml html={'<p>Hi <a href="https://x.test">link</a></p><img src=x onerror="alert(1)"><script>alert(2)</script>'} />,
  );
  const html = container.innerHTML;
  expect(html).not.toContain('onerror');
  expect(html).not.toContain('<script');
  expect(container.querySelector('a')?.getAttribute('target')).toBe('_blank');
  expect(container.querySelector('a')?.getAttribute('rel')).toContain('noopener');
});
