import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RankBadge, RankChange } from '@/components/ui/RankIndicator';

describe('RankBadge', () => {
  it('should render gold medal for rank 1', () => {
    render(<RankBadge rank={1} />);
    expect(screen.getByText(/🥇/)).toBeDefined();
  });

  it('should render silver medal for rank 2', () => {
    render(<RankBadge rank={2} />);
    expect(screen.getByText(/🥈/)).toBeDefined();
  });

  it('should render bronze medal for rank 3', () => {
    render(<RankBadge rank={3} />);
    expect(screen.getByText(/🥉/)).toBeDefined();
  });

  it('should render numeric badge for ranks > 3', () => {
    render(<RankBadge rank={5} />);
    expect(screen.getByText('5')).toBeDefined();
  });
});

describe('RankChange', () => {
  it('should render positive change with up arrow', () => {
    render(<RankChange change={3} />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('should render negative change with down arrow', () => {
    render(<RankChange change={-2} />);
    expect(screen.getByText('2')).toBeDefined();
  });

  it('should render dash for no change', () => {
    render(<RankChange change={0} />);
    expect(screen.getByText('—')).toBeDefined();
  });
});
