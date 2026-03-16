import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageLayout } from '@/components/layout/PageLayout';

const { capture } = vi.hoisted(() => ({
  capture: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('posthog-js', () => ({
  default: {
    capture,
  },
}));

function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
    })),
  });
}

describe('PageLayout', () => {
  beforeEach(() => {
    capture.mockReset();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
    mockMatchMedia(false);
  });

  it('toggles dark mode from the header button for the current session', () => {
    render(
      <PageLayout activePage="/leaderboard">
        <div>Content</div>
      </PageLayout>
    );

    const toggle = screen.getByRole('button', { name: 'Switch to dark mode' });
    fireEvent.click(toggle);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeDefined();
  });
});
