import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

describe('ErrorMessage', () => {
  it('renders error message from Error object', () => {
    render(<ErrorMessage error={new Error('Something went wrong')} />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('renders generic title', () => {
    render(<ErrorMessage error={new Error('any error')} />);
    expect(screen.getByText('Failed to load leaderboard')).toBeDefined();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorMessage error={new Error('Test error')} onRetry={onRetry} />);
    
    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('hides retry button when onRetry not provided', () => {
    render(<ErrorMessage error={new Error('Test error')} />);
    expect(screen.queryByText('Try Again')).toBeNull();
  });
});
