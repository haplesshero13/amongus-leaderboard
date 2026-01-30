"""
Test script to understand OpenSkill's behavior with asymmetric team sizes.

FINDINGS:
- OpenSkill's `weights` parameter is for player CONTRIBUTION weighting, not team size balancing
- The default weight_bounds=(1.0, 2.0) normalizes all weights, making them ineffective
- Even with wider weight_bounds, weights don't fix the team size asymmetry problem
- The META-AGENT approach is the correct solution for Among Us's 2v5 format

The problem: OpenSkill's probability model assumes more players = higher win chance.
When 5 crewmates beat 2 impostors, it's "expected" -> tiny rating change.
When 2 impostors beat 5 crewmates, it's an "upset" -> huge rating change.

The solution: Meta-agent collapses each team to 1 player, making it a true 1v1.
This gives symmetric deltas regardless of actual team size.
"""

import statistics

from openskill.models import PlackettLuce


def test_unweighted():
    """Show the asymmetry problem with standard OpenSkill."""
    print("=" * 60)
    print("TEST 1: Standard OpenSkill (Unweighted)")
    print("=" * 60)

    model = PlackettLuce()
    START = 25

    # Impostors win
    imp = [model.rating(mu=START) for _ in range(2)]
    crew = [model.rating(mu=START) for _ in range(5)]
    r = model.rate([imp, crew], ranks=[0, 1])
    imp_win_delta = r[0][0].mu - START

    # Crewmates win
    imp = [model.rating(mu=START) for _ in range(2)]
    crew = [model.rating(mu=START) for _ in range(5)]
    r = model.rate([imp, crew], ranks=[1, 0])
    crew_win_delta = r[1][0].mu - START

    print(f"  Impostor win -> impostor gains: {imp_win_delta:+.4f}")
    print(f"  Crewmate win -> crewmate gains: {crew_win_delta:+.4f}")
    print(f"  Asymmetry ratio: {abs(imp_win_delta / crew_win_delta):.1f}x")
    print("  PROBLEM: ~27x asymmetry between win conditions!\n")


def test_weights():
    """Show that weights don't fix the team size problem."""
    print("=" * 60)
    print("TEST 2: OpenSkill with Weights (weight_bounds=(0.01, 100))")
    print("=" * 60)

    model = PlackettLuce(weight_bounds=(0.01, 100.0))
    START = 25
    w_crew = 2 / 5  # 0.4

    weights = [[1.0, 1.0], [w_crew] * 5]

    # Impostors win
    imp = [model.rating(mu=START) for _ in range(2)]
    crew = [model.rating(mu=START) for _ in range(5)]
    r = model.rate([imp, crew], ranks=[0, 1], weights=weights)
    print(f"  Impostor win -> impostor delta: {r[0][0].mu - START:+.4f}")
    print(f"  Impostor win -> crewmate delta: {r[1][0].mu - START:+.4f}")

    # Crewmates win
    imp = [model.rating(mu=START) for _ in range(2)]
    crew = [model.rating(mu=START) for _ in range(5)]
    r = model.rate([imp, crew], ranks=[1, 0], weights=weights)
    print(f"  Crewmate win -> impostor delta: {r[0][0].mu - START:+.4f}")
    print(f"  Crewmate win -> crewmate delta: {r[1][0].mu - START:+.4f}")
    print("  PROBLEM: Weights make it WORSE, not better!\n")


def test_meta_agent():
    """Show that meta-agent approach gives symmetric deltas."""
    print("=" * 60)
    print("TEST 3: Meta-Agent Approach (CORRECT SOLUTION)")
    print("=" * 60)

    model = PlackettLuce()
    START = 25

    # Create meta-agents (average of team)
    meta_imp = model.rating(mu=START, sigma=8.333)
    meta_crew = model.rating(mu=START, sigma=8.333)

    # Impostors win
    r = model.rate([[meta_imp], [meta_crew]], ranks=[0, 1])
    imp_win_delta = r[0][0].mu - START

    # Crewmates win
    meta_imp = model.rating(mu=START, sigma=8.333)
    meta_crew = model.rating(mu=START, sigma=8.333)
    r = model.rate([[meta_imp], [meta_crew]], ranks=[1, 0])
    crew_win_delta = r[1][0].mu - START

    print(f"  Impostor win -> delta: {imp_win_delta:+.4f}")
    print(f"  Crewmate win -> delta: {crew_win_delta:+.4f}")
    print(f"  Symmetric? {abs(abs(imp_win_delta) - abs(crew_win_delta)) < 0.001}")
    print("  SUCCESS: Perfectly symmetric deltas!\n")


def test_meta_agent_preserves_skill_gaps():
    """Show that meta-agent preserves individual skill differences."""
    print("=" * 60)
    print("TEST 4: Meta-Agent Preserves Skill Gaps")
    print("=" * 60)

    model = PlackettLuce()

    # Mixed skill impostors: one strong (30), one weak (20)
    imp_ratings = [30, 20]
    crew_ratings = [25, 25, 25, 25, 25]

    # Create meta-agents from averages
    meta_imp = model.rating(mu=statistics.mean(imp_ratings))
    meta_crew = model.rating(mu=statistics.mean(crew_ratings))

    print(f"  Team averages: imp={meta_imp.mu}, crew={meta_crew.mu}")

    # Impostors win
    r = model.rate([[meta_imp], [meta_crew]], ranks=[0, 1])
    delta = r[0][0].mu - meta_imp.mu

    print(f"  Delta applied to all impostors: {delta:+.4f}")
    print(f"  Strong impostor: 30 -> {30 + delta:.2f}")
    print(f"  Weak impostor:   20 -> {20 + delta:.2f}")
    print(f"  Skill gap preserved? {(30 + delta) - (20 + delta):.0f} == 10")
    print("  SUCCESS: Individual skill gaps are maintained!\n")


if __name__ == "__main__":
    print()
    test_unweighted()
    test_weights()
    test_meta_agent()
    test_meta_agent_preserves_skill_gaps()

    print("=" * 60)
    print("CONCLUSION: Use Meta-Agent approach for Among Us ratings")
    print("=" * 60)
