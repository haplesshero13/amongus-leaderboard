
import { RawAgentLog } from '@/types/game';

// A minimal representation of the legacy log format
// based on https://api.lmdeceptionarena.averyyen.dev/api/games/230a61e5-5f01-4f93-9a78-b59c6b3ffcc2/logs
// Truncated to just include relevant parts for testing (kill/ejection)
export const legacyLog: RawAgentLog[] = [
    {
        "game_index": "Game 0",
        "step": 0,
        "timestamp": "2026-01-29 19:28:13.179224",
        "player": {
            "name": "Player 1: purple",
            "identity": "Crewmate",
            "personality": null,
            "model": "moonshotai/kimi-k2-thinking",
            "location": "Cafeteria"
        },
        "interaction": {
            "system_prompt": "...",
            "prompt": {
                // ...
            },
            "response": {
                "Condensed Memory": "...",
                "Thinking Process": {
                    "thought": "...",
                    "action": "MOVE from Cafeteria to Upper Engine"
                },
            },
            "full_response": "..."
        }
    },
    // Timestep 0: Player 6 kills Player 7 (Action history format)
    {
        "game_index": "Game 0",
        "step": 1,
        "timestamp": "2026-01-29 19:30:21.049898",
        "player": {
            "name": "Player 6: pink",
            "identity": "Impostor",
            "location": "Cafeteria"
        },
        "interaction": {
            // ...
            "prompt": {
                // This is the key part - the prompt shows "Action history: Timestep 0: ... KILL Player 7"
                // But usually we parse the response of the CURRENT step, or the "Action history" of SUBSEQUENT steps?
                // Wait, looking at the provided JSON in the previous turn:
                // The log for Player 6 at step 1 shows "Action history: Timestep 0: [task phase] KILL Player 7: lime"
                // AND the response for step 0 shows "Action": "KILL Player 7: lime" in the JSON structure I saw earlier.
            },
            "response": {
                // This is Player 6's response at step 1 (thinking about next move)
                // The KILL happened at step 0.
                // Let's include the step 0 log for Player 6 where the kill actually happens.
            }
        }
    }
] as unknown as RawAgentLog[];

export const legacyKillLog: RawAgentLog[] = [
    {
        "game_index": "Game 0",
        "step": 0,
        "timestamp": "2026-01-29 19:28:13.179224",
        "player": {
            "name": "Player 7: lime",
            "identity": "Crewmate",
            "location": "Cafeteria"
        },
        "interaction": {}
    },
    {
        "game_index": "Game 0",
        "step": 0,
        "timestamp": "2026-01-29 19:29:05.317722",
        "player": {
            "name": "Player 6: pink",
            "identity": "Impostor",
            "personality": null,
            "model": "meta-llama/llama-4-scout",
            "location": "Cafeteria"
        },
        "interaction": {
            "system_prompt": "...",
            "prompt": { "Phase": "Task phase" },
            "response": {
                "Condensed Memory": "...",
                "Thinking Process": { "thought": "...", "action": "KILL Player 7: lime" },
            },
            "full_response": "[Action]\nKILL Player 7: lime"
        }
    }
] as unknown as RawAgentLog[];

export const legacyEjectionLog: RawAgentLog[] = [
    // Simulating a vote round based on how it appears in legacy logs
    // Usually standard voting is preserved in logs similarly across versions? 
    // Let's assume standard voting format for now, or look at specific legacy voting if available.
    // The provided log was huge and I didn't see the election part, but the kill part is key.
] as unknown as RawAgentLog[];
