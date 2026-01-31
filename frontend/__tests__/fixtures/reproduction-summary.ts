export const reproSummary = {
    "config": {
        "num_players": 7,
        "num_impostors": 2,
        "num_common_tasks": 1,
        "num_short_tasks": 1,
        "num_long_tasks": 1,
        "discussion_rounds": 3,
        "max_num_buttons": 2,
        "kill_cooldown": 3,
        "max_timesteps": 50
    },
    "Player 1": {
        "name": "Player 1: red",
        "color": "red",
        "identity": "Crewmate",
        "model": "qwen/qwen3-next-80b-a3b-thinking",
        "personality": null,
        "tasks": [
            "Fix Wiring",
            "Download Data",
            "Fuel Engines"
        ]
    },
    "Player 2": {
        "name": "Player 2: yellow",
        "color": "yellow",
        "identity": "Crewmate",
        "model": "google/gemini-3-flash-preview",
        "personality": null,
        "tasks": [
            "Fix Wiring",
            "Download Data",
            "Align Engine Output"
        ]
    },
    "Player 3": {
        "name": "Player 3: purple",
        "color": "purple",
        "identity": "Crewmate",
        "model": "meta-llama/llama-3.1-405b-instruct",
        "personality": null,
        "tasks": [
            "Fix Wiring",
            "Chart Course",
            "Inspect Sample"
        ]
    },
    "Player 4": {
        "name": "Player 4: pink",
        "color": "pink",
        "identity": "Impostor",
        "model": "openai/gpt-oss-20b",
        "personality": null,
        "tasks": [
            "Fix Wiring"
        ]
    },
    "Player 5": {
        "name": "Player 5: white",
        "color": "white",
        "identity": "Impostor",
        "model": "z-ai/glm-4.7",
        "personality": null,
        "tasks": [
            "Fix Wiring"
        ]
    },
    "Player 6": {
        "name": "Player 6: blue",
        "color": "blue",
        "identity": "Crewmate",
        "model": "z-ai/glm-4.7-flash",
        "personality": null,
        "tasks": [
            "Fix Wiring",
            "Download Data",
            "Empty Chute"
        ]
    },
    "Player 7": {
        "name": "Player 7: orange",
        "color": "orange",
        "identity": "Crewmate",
        "model": "openai/gpt-5-mini",
        "personality": null,
        "tasks": [
            "Fix Wiring",
            "Accept Diverted Power",
            "Empty Garbage"
        ]
    },
    "voting_history": [
        {
            "timestep": 4,
            "meeting_number": 1,
            "votes": [
                {
                    "voter": "Player 1: red: red",
                    "target": "Player 2: yellow: yellow",
                    "timestep": 4
                },
                {
                    "voter": "Player 2: yellow: yellow",
                    "target": "Player 4: pink: pink",
                    "timestep": 4
                },
                {
                    "voter": "Player 3: purple: purple",
                    "target": "Player 2: yellow: yellow",
                    "timestep": 4
                },
                {
                    "voter": "Player 4: pink: pink",
                    "target": "Player 2: yellow: yellow",
                    "timestep": 4
                },
                {
                    "voter": "Player 5: white: white",
                    "target": "Player 2: yellow: yellow",
                    "timestep": 4
                }
            ],
            "vote_tally": {
                "Player 2: yellow: yellow": 4,
                "Player 4: pink: pink": 1
            },
            "eliminated": "Player 2: yellow: yellow",
            "was_tie": false
        }
    ],
    "kill_history": [
        {
            "timestep": 0,
            "killer": "Player 4: pink: pink",
            "victim": "Player 6: blue: blue",
            "location": "Cafeteria",
            "witnesses": [
                "Player 5: white: white",
                "Player 7: orange: orange"
            ],
            "method": "kill"
        },
        {
            "timestep": 0,
            "killer": "Player 5: white: white",
            "victim": "Player 7: orange: orange",
            "location": "Cafeteria",
            "witnesses": [
                "Player 4: pink: pink"
            ],
            "method": "kill"
        }
    ],
    "game_outcome": {
        "winner": "Impostors",
        "reason": "Impostors win! (Crewmates being outnumbered or tied to impostors))",
        "surviving_players": [
            "Player 1: red: red",
            "Player 3: purple: purple",
            "Player 4: pink: pink",
            "Player 5: white: white"
        ],
        "eliminated_players": [
            "Player 2: yellow: yellow",
            "Player 6: blue: blue",
            "Player 7: orange: orange"
        ],
        "final_impostor_count": 2,
        "final_crewmate_count": 2
    },
    "issues": {
        "total_count": 2,
        "by_model": {}
    },
    "winner": 1,
    "winner_reason": "Impostors win! (Crewmates being outnumbered or tied to impostors))"
};
