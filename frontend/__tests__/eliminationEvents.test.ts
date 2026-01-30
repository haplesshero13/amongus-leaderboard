import { describe, it, expect } from 'vitest';
import { extractEliminationEvents } from '@/lib/utils/eliminationEvents';

import {
  killAndEjectLogs,
  killAndEjectSummary,
} from './fixtures/game-logs-kill-and-eject';

import {
  finalEliminationLogs,
  finalEliminationSummary,
  expectedEvents as finalEliminationExpected,
} from './fixtures/game-logs-final-elimination';

import {
  voteTieLogs,
  alternativeFormatLogs,
  noFullResponseLogs,
  edgeCaseSummary,
} from './fixtures/game-logs-edge-cases';

describe('extractEliminationEvents', () => {
  describe('standard kill and ejection', () => {
    it('detects a kill at step 5', () => {
      const events = extractEliminationEvents(killAndEjectLogs, killAndEjectSummary);

      const killEvent = events.find((e) => e.type === 'killed');
      expect(killEvent).toBeDefined();
      expect(killEvent?.step).toBe(5);
      expect(killEvent?.victimPlayerNumber).toBe(1);
      expect(killEvent?.victimColor).toBe('brown');
      expect(killEvent?.victimRole).toBe('Crewmate');
      expect(killEvent?.killerPlayerNumber).toBe(3);
    });

    it('detects an ejection at step 10', () => {
      const events = extractEliminationEvents(killAndEjectLogs, killAndEjectSummary);

      const ejectEvent = events.find((e) => e.type === 'ejected');
      expect(ejectEvent).toBeDefined();
      expect(ejectEvent?.step).toBe(10);
      expect(ejectEvent?.victimPlayerNumber).toBe(3);
      expect(ejectEvent?.victimColor).toBe('red');
      expect(ejectEvent?.victimRole).toBe('Impostor');
    });

    it('returns events in step order', () => {
      const events = extractEliminationEvents(killAndEjectLogs, killAndEjectSummary);

      expect(events.length).toBe(2);
      expect(events[0].step).toBeLessThan(events[1].step);
    });

    it('includes vote information for ejections', () => {
      const events = extractEliminationEvents(killAndEjectLogs, killAndEjectSummary);

      const ejectEvent = events.find((e) => e.type === 'ejected');
      expect(ejectEvent?.votes).toBeDefined();
      expect(Object.keys(ejectEvent?.votes || {}).length).toBeGreaterThan(0);
    });
  });

  describe('final elimination detection', () => {
    it('detects all three kills including the final one', () => {
      const events = extractEliminationEvents(finalEliminationLogs, finalEliminationSummary);

      expect(events.length).toBe(3);
    });

    it('detects kill at step 10', () => {
      const events = extractEliminationEvents(finalEliminationLogs, finalEliminationSummary);

      const firstKill = events.find((e) => e.step === 10);
      expect(firstKill).toBeDefined();
      expect(firstKill?.victimPlayerNumber).toBe(4);
      expect(firstKill?.victimColor).toBe('blue');
    });

    it('detects kill at step 12', () => {
      const events = extractEliminationEvents(finalEliminationLogs, finalEliminationSummary);

      const secondKill = events.find((e) => e.step === 12);
      expect(secondKill).toBeDefined();
      expect(secondKill?.victimPlayerNumber).toBe(5);
      expect(secondKill?.victimColor).toBe('green');
    });

    it('detects the FINAL kill at step 15 (the bug case)', () => {
      const events = extractEliminationEvents(finalEliminationLogs, finalEliminationSummary);

      const finalKill = events.find((e) => e.step === 15);
      expect(finalKill).toBeDefined();
      expect(finalKill?.victimPlayerNumber).toBe(6);
      expect(finalKill?.victimColor).toBe('yellow');
      expect(finalKill?.victimRole).toBe('Crewmate');
      expect(finalKill?.killerPlayerNumber).toBe(1);
    });

    it('matches all expected events', () => {
      const events = extractEliminationEvents(finalEliminationLogs, finalEliminationSummary);

      expect(events.length).toBe(finalEliminationExpected.length);

      for (const expected of finalEliminationExpected) {
        const found = events.find(
          (e) => e.step === expected.step && e.victimPlayerNumber === expected.victimPlayerNumber
        );
        expect(found).toBeDefined();
        expect(found?.type).toBe(expected.type);
        expect(found?.victimColor).toBe(expected.victimColor);
        expect(found?.victimRole).toBe(expected.victimRole);
      }
    });
  });

  describe('edge cases', () => {
    it('does NOT create ejection event for vote tie', () => {
      const events = extractEliminationEvents(voteTieLogs, edgeCaseSummary);

      // Vote tie: 2 votes for Player 1, 2 votes for Player 2 = no ejection
      const ejections = events.filter((e) => e.type === 'ejected');
      expect(ejections.length).toBe(0);
    });

    it('detects kill with alternative format (no [Action] prefix)', () => {
      const events = extractEliminationEvents(alternativeFormatLogs, edgeCaseSummary);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('killed');
      expect(events[0].victimPlayerNumber).toBe(3);
      expect(events[0].victimColor).toBe('green');
      expect(events[0].killerPlayerNumber).toBe(2);
    });

    it('detects kill when only in response.Action (no full_response)', () => {
      const events = extractEliminationEvents(noFullResponseLogs, edgeCaseSummary);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('killed');
      expect(events[0].victimPlayerNumber).toBe(5);
      expect(events[0].victimColor).toBe('cyan');
      expect(events[0].killerPlayerNumber).toBe(1);
    });

    it('handles empty logs', () => {
      const events = extractEliminationEvents([], null);
      expect(events).toEqual([]);
    });

    it('handles logs without any eliminations', () => {
      const normalLogs = [
        {
          step: 1,
          timestamp: '2026-01-29T10:00:00Z',
          player: {
            name: 'Player 1: red',
            identity: 'Crewmate',
            personality: null,
            model: 'gpt-5',
            location: 'Cafeteria',
          },
          interaction: {
            response: { Action: 'MOVE to Electrical' },
            full_response: '[Action] MOVE to Electrical',
          },
        },
      ];

      const events = extractEliminationEvents(normalLogs, null);
      expect(events.length).toBe(0);
    });

    it('does not double-count eliminated players', () => {
      // If a player appears in multiple kill actions, only count once
      const duplicateLogs = [
        {
          step: 5,
          timestamp: '2026-01-29T10:05:00Z',
          player: {
            name: 'Player 1: red',
            identity: 'Impostor',
            personality: null,
            model: 'gpt-5',
            location: 'Electrical',
          },
          interaction: {
            response: { Action: 'KILL Player 2' },
            full_response: '[Action] KILL Player 2',
          },
        },
        {
          step: 6,
          timestamp: '2026-01-29T10:06:00Z',
          player: {
            name: 'Player 3: pink',
            identity: 'Impostor',
            personality: null,
            model: 'claude-4',
            location: 'Electrical',
          },
          interaction: {
            // Somehow trying to kill same player again (shouldn't happen but test defensively)
            response: { Action: 'KILL Player 2' },
            full_response: '[Action] KILL Player 2',
          },
        },
      ];

      const events = extractEliminationEvents(duplicateLogs, null);
      expect(events.length).toBe(1);
      expect(events[0].victimPlayerNumber).toBe(2);
    });
  });

  describe('uses summary for player info', () => {
    it('gets color from summary when available', () => {
      const events = extractEliminationEvents(killAndEjectLogs, killAndEjectSummary);

      const killEvent = events.find((e) => e.type === 'killed');
      // Summary says Player 1 is brown
      expect(killEvent?.victimColor).toBe('brown');
    });

    it('gets role from summary when available', () => {
      const events = extractEliminationEvents(killAndEjectLogs, killAndEjectSummary);

      const ejectEvent = events.find((e) => e.type === 'ejected');
      // Summary says Player 3 is Impostor
      expect(ejectEvent?.victimRole).toBe('Impostor');
    });

    it('falls back to log-extracted color when no summary', () => {
      const events = extractEliminationEvents(killAndEjectLogs, null);

      const killEvent = events.find((e) => e.type === 'killed');
      // Should still get brown from the log's player name "Player 1: brown"
      expect(killEvent?.victimColor).toBe('brown');
    });
  });
});
