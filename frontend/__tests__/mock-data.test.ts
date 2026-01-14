import { describe, it, expect } from 'vitest';
import { mockModels, getMockLeaderboard } from '@/lib/api/mock-data';

describe('Mock Data', () => {
  describe('mockModels', () => {
    it('should have at least 15 models', () => {
      expect(mockModels.length).toBeGreaterThanOrEqual(15);
    });

    it('should have unique model IDs', () => {
      const ids = mockModels.map((m) => m.model_id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have ratings within valid range (1000-2000)', () => {
      mockModels.forEach((model) => {
        expect(model.overall_rating).toBeGreaterThanOrEqual(1000);
        expect(model.overall_rating).toBeLessThanOrEqual(2000);
        expect(model.impostor_rating).toBeGreaterThanOrEqual(1000);
        expect(model.impostor_rating).toBeLessThanOrEqual(2000);
        expect(model.crewmate_rating).toBeGreaterThanOrEqual(1000);
        expect(model.crewmate_rating).toBeLessThanOrEqual(2000);
      });
    });

    it('should have games played within valid range (50-200)', () => {
      mockModels.forEach((model) => {
        expect(model.games_played).toBeGreaterThanOrEqual(50);
        expect(model.games_played).toBeLessThanOrEqual(200);
      });
    });

    it('should have rank changes within valid range (-5 to +5)', () => {
      mockModels.forEach((model) => {
        expect(model.rank_change).toBeGreaterThanOrEqual(-5);
        expect(model.rank_change).toBeLessThanOrEqual(5);
      });
    });

    it('should be sorted by overall rating (highest first)', () => {
      for (let i = 1; i < mockModels.length; i++) {
        expect(mockModels[i - 1].overall_rating).toBeGreaterThanOrEqual(
          mockModels[i].overall_rating
        );
      }
    });
  });

  describe('getMockLeaderboard', () => {
    it('should return paginated data', () => {
      const result = getMockLeaderboard(1, 10);
      expect(result.data.length).toBe(10);
      expect(result.page).toBe(1);
      expect(result.per_page).toBe(10);
      expect(result.total).toBe(mockModels.length);
    });

    it('should return correct total pages', () => {
      const result = getMockLeaderboard(1, 5);
      expect(result.total_pages).toBe(Math.ceil(mockModels.length / 5));
    });

    it('should handle last page correctly', () => {
      const perPage = 10;
      const totalPages = Math.ceil(mockModels.length / perPage);
      const result = getMockLeaderboard(totalPages, perPage);
      expect(result.data.length).toBeLessThanOrEqual(perPage);
    });
  });
});
