"use client";

import { PageLayout } from "@/components/layout/PageLayout";

interface PromptLineProps {
  children: React.ReactNode;
  className?: string;
}

function P({ children, className = "" }: PromptLineProps) {
  return (
    <span
      className={`block font-mono text-[12px] leading-[1.85] tracking-[0.01em] text-gray-700 dark:text-gray-300 sm:text-[12.5px] ${className}`}
    >
      {children}
    </span>
  );
}

function K({ children }: PromptLineProps) {
  return <span className="font-semibold text-gray-900 dark:text-gray-100">{children}</span>;
}

function V({ children }: PromptLineProps) {
  return <span className="text-blue-700 dark:text-blue-400">{children}</span>;
}

function Dim({ children }: PromptLineProps) {
  return <span className="text-gray-400 dark:text-gray-500">{children}</span>;
}

function Trunc() {
  return (
    <span className="block font-mono text-[12px] italic leading-[1.85] text-gray-400 dark:text-gray-500 sm:text-[12.5px]">
      {"    ..."}
    </span>
  );
}

interface CardProps {
  badge: "impostor" | "crewmate" | "turn" | "summary" | "output" | "map" | "rules" | "correction";
  title: string;
  tag?: string;
  children: React.ReactNode;
}

const BADGE_STYLES: Record<string, string> = {
  impostor: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  crewmate: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  turn: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  summary: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  output: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  map: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  rules: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  correction: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const BADGE_LABELS: Record<string, string> = {
  impostor: "Impostor",
  crewmate: "Crewmate",
  turn: "Long Context",
  summary: "Summary Mode",
  output: "Output",
  map: "Map",
  rules: "Rules",
  correction: "Correction",
};

function Card({ badge, title, tag, children }: CardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm ring-1 ring-black/5 dark:border-gray-800 dark:bg-gray-900 dark:ring-white/5">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-medium tracking-[0.02em] ${BADGE_STYLES[badge]}`}>
          {BADGE_LABELS[badge]}
        </span>
        <span className="text-[12.5px] font-semibold tracking-[0.01em] text-gray-900 dark:text-gray-100">
          {title}
        </span>
        {tag && (
          <span className="ml-auto font-mono text-[10.5px] text-gray-400 dark:text-gray-500">
            {tag}
          </span>
        )}
      </div>
      <div className="whitespace-pre-wrap px-4 py-4">
        {children}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-3 pt-4 text-center text-[10.5px] font-medium uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
      {children}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-2">
      <div className="h-5 w-px bg-gray-300 dark:bg-gray-700" />
      <div className="h-0 w-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-gray-300 dark:border-t-gray-700" />
    </div>
  );
}

function FlowPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
      {children}
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <PageLayout activePage="/methodology" maxWidth="6xl">
      <section className="mx-auto mb-10 max-w-3xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/5 sm:p-8">
        <h2 className="mb-4 font-sans text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-[2rem]">
          Prompt Architecture
        </h2>
        <div className="space-y-4 font-sans text-[15px] leading-7 text-gray-700 dark:text-gray-300 sm:text-[16px]">
          <p className="max-w-[60ch]">
            Each AI player receives a <strong>system prompt</strong> that establishes
            their role, abilities, and the game rules, followed by a <strong>per-turn
            user message</strong> containing the current game state, observations, and
            available actions.
          </p>
          <p className="max-w-[60ch]">
            Season 0 used a summary-based agent that compressed history each turn.
            Season 1 uses a long-context agent that maintains the full conversation
            history. The prompts below are pulled from the live{" "}
            <code className="rounded bg-gray-100 px-1 text-sm dark:bg-gray-800">amongagents</code>{" "}
            engine and truncated for readability.
          </p>
        </div>
      </section>

      <section className="mb-8 flex flex-wrap items-center justify-center gap-2">
        <FlowPill>1. Game setup</FlowPill>
        <FlowPill>2. System prompts</FlowPill>
        <FlowPill>3. Turn prompts</FlowPill>
        <FlowPill>4. Turn responses</FlowPill>
      </section>

      <SectionLabel>Game setup</SectionLabel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card badge="map" title="Skeld — rooms &amp; vents" tag="14 rooms">
          <P><K>Room Connections:</K>{"\n"}Cafeteria ↔ Weapons, Admin, Upper Engine, Medbay{"\n"}Weapons ↔ Cafeteria, Navigation, O2{"\n"}Navigation ↔ Weapons, Shields{"\n"}O2 ↔ Weapons, Shields, Admin{"\n"}Shields ↔ Navigation, O2, Comms, Storage</P>
          <Trunc />
          <P>{"\n\n"}<K>Vent Connections</K> (Impostors only):{"\n"}Cafeteria ↔ Admin{"\n"}Weapons ↔ Navigation{"\n"}Navigation ↔ Shields, Weapons{"\n"}Electrical ↔ Security, Medbay{"\n"}Reactor ↔ Upper Engine, Lower Engine</P>
          <Trunc />
          <P>{"\n"}<Dim>Full map config included in every system prompt.</Dim></P>
        </Card>

        <Card badge="rules" title="Game configuration" tag="7 players">
          <P><K>Standard match:</K>{"\n"}7 players, 2 Impostors, 5 Crewmates.{"\n"}Kill cooldown: configured per game.{"\n"}Max timesteps: 50.{"\n\n"}</P>
          <P><K>Win conditions:</K>{"\n"}1. Impostors win — equal or outnumber Crewmates{"\n"}2. Crewmates win — all Impostors ejected{"\n"}3. Crewmates win — all tasks completed{"\n"}4. Impostors win — timestep 50 reached{"\n\n"}</P>
          <P><K>Agent types:</K>{"\n"}- <K>LongContext</K> (Season 1): Full chat history, JSON output{"\n"}- <K>ShortContext</K> (Season 0): Summarized context, tagged output{"\n\n"}</P>
          <P><Dim>Model assignment: &quot;unique&quot; mode — each model plays once.</Dim></P>
        </Card>
      </div>

      <SectionLabel>Agent system prompts</SectionLabel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card badge="impostor" title="System prompt" tag="Season 1">
          <P><V>You are {"{name}"}. You are an Impostor on the spaceship Skeld.</V>{"\n"}There are <V>{"{num_players}"}</V> players, <V>{"{num_impostors}"}</V> Impostor(s).{"\n\n"}<V>{"{impostor_teammates_text}"}</V>{"\n\n"}<K>OBJECTIVE:</K> Eliminate Crewmates until Impostors equal or outnumber{"\n"}Crewmates, before all tasks are completed.{"\n\n"}</P>
          <P><K>GAME END CONDITIONS:</K>{"\n"}- Impostors win if they equal or outnumber Crewmates.{"\n"}- Impostors win if timestep is 50.{"\n"}- Crewmates win if all Impostors are ejected.{"\n"}- Crewmates win if all tasks are completed.{"\n\n"}</P>
          <P><K>GAME PHASES:</K>{"\n"}- <K>Task Phase:</K> Move around, perform fake tasks, and KILL{"\n"}  isolated Crewmates. You can VENT to travel quickly{"\n"}  between connected vent locations.{"\n"}- <K>Meeting Phase:</K> Discuss (SPEAK), then VOTE to eject{"\n"}  a player or SKIP VOTE. Deceive others and redirect suspicion.{"\n\n"}</P>
          <P><K>IMPOSTOR ABILITIES</K> (only you can do these):{"\n"}- KILL: Eliminate a Crewmate in the same room ({"{kill_cooldown}"}-timestep cooldown){"\n"}- VENT: Travel instantly between connected vent locations{"\n"}- COMPLETE FAKE TASK: Pretend to do tasks (doesn&apos;t actually complete them)</P>
          <Trunc />
          <P>{"\n"}<K>SHARED ABILITIES</K> (Task Phase — all players can use):{"\n"}- MOVE: Travel to adjacent rooms{"\n"}- CALL MEETING: Press the emergency button (only in Cafeteria){"\n"}- REPORT DEAD BODY: Report a body in your room{"\n"}- VIEW MONITOR: Watch security cameras (only in Security)</P>
          <Trunc />
          <P>{"\n"}<K>IMPORTANT:</K>{"\n"}- WITNESSES can see your kills and report them! Kill only when isolated.{"\n"}- Voted-out players are EJECTED and do not leave behind a body.</P>
          <Trunc />
          <P>{"\n"}<Dim>{"{map configuration + room connections}"}</Dim></P>
          <Trunc />
          <P>{"\n"}<K>OUTPUT FORMAT:</K>{"\n"}Respond with ONLY a valid JSON object:{"\n"}{"{"} <V>&quot;thinking&quot;</V>: &lt;reasoning&gt;, <V>&quot;action&quot;</V>: &lt;action&gt; {"}"}</P>
        </Card>

        <Card badge="crewmate" title="System prompt" tag="Season 1">
          <P><V>You are {"{name}"}. You are a Crewmate on the spaceship Skeld.</V>{"\n"}There are <V>{"{num_players}"}</V> players, <V>{"{num_impostors}"}</V> Impostor(s).{"\n\n"}<K>OBJECTIVE:</K> Complete all tasks OR identify and eject all Impostors{"\n"}before they eliminate enough Crewmates.{"\n\n"}</P>
          <P><K>GAME END CONDITIONS:</K>{"\n"}- Impostors win if they equal or outnumber Crewmates.{"\n"}- Impostors win if timestep is 50.{"\n"}- Crewmates win if all Impostors are ejected.{"\n"}- Crewmates win if all tasks are completed.{"\n\n"}</P>
          <P><K>IMPORTANT:</K>{"\n"}- Impostors KILL Crewmates in the same room ({"{kill_cooldown}"}-timestep cooldown).{"\n"}- Impostors can VENT between non-adjacent rooms. If you see someone{"\n"}  vent, they are an Impostor!{"\n"}- Voted-out players are EJECTED and do not leave behind a body.{"\n\n"}</P>
          <P><K>GAME PHASES:</K>{"\n"}- <K>Task Phase:</K> COMPLETE TASK at task locations, MOVE to gather{"\n"}  evidence, REPORT DEAD BODY, or CALL MEETING in Cafeteria.{"\n"}- <K>Meeting Phase:</K> SPEAK to share observations, then VOTE to{"\n"}  eject suspected Impostors or SKIP VOTE if unsure.{"\n\n"}</P>
          <P><K>CREWMATE ABILITY</K> (only Crewmates can do this):{"\n"}- COMPLETE TASK: Do your assigned tasks to help the crew win</P>
          <Trunc />
          <P>{"\n"}<K>SHARED ABILITIES</K> (Task Phase — all players can use):{"\n"}- MOVE: Travel to adjacent rooms{"\n"}- CALL MEETING: Press the emergency button (only in Cafeteria){"\n"}- REPORT DEAD BODY: Report a body in your room{"\n"}- VIEW MONITOR: Watch security cameras (only in Security)</P>
          <Trunc />
          <P>{"\n"}<Dim>{"{map configuration + room connections}"}</Dim></P>
          <Trunc />
          <P>{"\n"}<K>OUTPUT FORMAT:</K>{"\n"}Respond with ONLY a valid JSON object:{"\n"}{"{"} <V>&quot;thinking&quot;</V>: &lt;reasoning&gt;, <V>&quot;action&quot;</V>: &lt;action&gt; {"}"}</P>
        </Card>
      </div>

      <Connector />
      <SectionLabel>Turn prompts</SectionLabel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card badge="turn" title="Turn message" tag="Season 1 · Long Context">
          <P><K>=== Turn <V>{"{N}"}</V> ===</K>{"\n"}</P>
          <P><V>{"CURRENT LOCATION: Storage"}</V>{"\n"}<V>{"Players here: Player 2: green, Player 7: yellow"}</V>{"\n"}<V>{"Kill cooldown: ready"}</V>{"\n\n"}</P>
          <P><K>OBSERVATION HISTORY OF ALL PLAYERS:</K>{"\n"}1. T5: Player 1: blue — MOVE Shields → O2{"\n"}2. T5: Player 2: green — COMPLETE TASK at Storage{"\n"}</P>
          <Trunc />
          <P>{"\n"}<K>YOUR ACTION HISTORY:</K>{"\n"}Timestep 4: [task phase] MOVE Shields → Storage{"\n"}</P>
          <Trunc />
          <P>{"\n"}<K>YOUR ASSIGNED TASKS:</K>{"\n"}1. Fix Wiring (Navigation) <V>[completed]</V>{"\n"}   Path: Storage→Shields→Navigation{"\n"}2. Stabilize Steering (Navigation){"\n"}   Path: Storage→Shields→Navigation{"\n"}</P>
          <Trunc />
          <P>{"\n"}<K>YOUR AVAILABLE ACTIONS</K> (pick one):{"\n"}1. MOVE from Storage to Shields{"\n"}2. MOVE from Storage to Lower Engine{"\n"}3. KILL Player 2: green{"\n"}4. KILL Player 7: yellow{"\n"}5. COMPLETE FAKE TASK at Storage</P>
          <Trunc />
          <P>{"\n"}<Dim>Full chat history accumulates across turns — no summarization.</Dim></P>
        </Card>

        <Card badge="summary" title="Turn message" tag="Season 0 · Summary Mode">
          <P><K>Summarization:</K> <V>Moved from Cafeteria → Weapons{"\n"}at T0 with Players 1, 3, 4, 7. No suspicious{"\n"}activity observed yet.</V>{"\n\n"}</P>
          <P><V>{"CURRENT LOCATION: Weapons"}</V>{"\n"}<V>{"Players here: 1-blue, 3-black, 4-lime, 5-purple,"}</V>{"\n"}<V>{"  7-yellow"}</V>{"\n"}<V>{"Player 1: blue — seemingly doing task"}</V>{"\n\n"}</P>
          <P><K>Tasks:</K>{"\n"}  Fix Wiring (Navigation)            □{"\n"}  Stabilize Steering (Navigation)    □{"\n"}  Empty Garbage (Storage)            □{"\n\n"}</P>
          <P><K>Memory:</K> <V>Moved with crowd from Cafeteria.{"\n"}No venting or kill observed.</V>{"\n\n"}</P>
          <P><K>Phase:</K> Task. Return your output.</P>
          <Trunc />
          <P>{"\n"}<Dim>Each turn, the previous summary is replaced — context does not grow.</Dim></P>
          <P>{"\n"}<Dim>Output format: [Condensed Memory], [Thinking Process], [Action].</Dim></P>
        </Card>
      </div>

      <Connector />
      <SectionLabel>Turn responses</SectionLabel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card badge="output" title="JSON response" tag="Season 1">
          <P><K>Standard model:</K>{"\n"}{"{"}{"\n"}  <V>&quot;thinking&quot;</V>: &lt;reasoning about the current{"\n"}    situation and what to do&gt;,{"\n"}  <V>&quot;action&quot;</V>: &lt;EXACTLY one action copied{"\n"}    from the Available actions list&gt;{"\n"}{"}"}</P>
          <Trunc />
          <P>{"\n"}<K>Reasoning model:</K>{"\n"}Native reasoning tokens are used for thinking.{"\n"}{"{"}{"\n"}  <V>&quot;action&quot;</V>: &lt;EXACTLY one action copied{"\n"}    from the Available actions list&gt;{"\n"}{"}"}</P>
        </Card>

        <Card badge="correction" title="Retry prompt" tag="Attempt 2/3">
          <P><K>Attempt <V>{"{N}"}</V>/3.</K> Error: Action &apos;walk to{"\n"}Storage&apos; not found in available actions.{"\n\n"}</P>
          <P>Respond with ONLY a valid JSON object:{"\n"}{"{"} <V>&quot;thinking&quot;</V>: &lt;reasoning&gt;, <V>&quot;action&quot;</V>: &lt;action&gt; {"}"}</P>
          <Trunc />
          <P>{"\n"}<K>Available actions</K> (copy exactly):{"\n"}  - MOVE from Cafeteria to Weapons{"\n"}  - MOVE from Cafeteria to Admin{"\n"}  - CALL MEETING using the emergency button</P>
          <Trunc />
          <P>{"\n"}<Dim>3 format retries. Voting phase falls back to SKIP VOTE.</Dim></P>
        </Card>

        <Card badge="rules" title="Meeting phases" tag="Shared">
          <P><K>Meeting Phase:</K>{"\n"}3 discussion rounds (SPEAK), then 1{"\n"}voting round (VOTE / SKIP VOTE).{"\n\n"}</P>
          <P><K>VOTING RULES:</K>{"\n"}- SKIP VOTE if uncertain.{"\n"}- TIE vote → NO ONE is ejected.{"\n"}- Voting results revealed after all votes.{"\n\n"}</P>
          <P><K>Key rules:</K>{"\n"}- All bodies cleared when any meeting starts.{"\n"}- Cannot observe events in other rooms{"\n"}  (except VIEW MONITOR in Security).{"\n"}- Only Impostors can KILL and VENT.</P>
        </Card>
      </div>

      <section className="mx-auto mt-10 max-w-4xl rounded-2xl bg-gray-100 p-5 dark:bg-gray-800 sm:p-6">
        <p className="font-sans text-[14px] leading-6 text-gray-600 dark:text-gray-400 sm:text-[15px]">
          <strong>Source:</strong> These prompts are pulled from the{" "}
          <a
            href="https://github.com/haplesshero13/AmongLLMs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            AmongLLMs
          </a>{" "}
          engine (<code className="rounded bg-gray-200 px-1 text-xs dark:bg-gray-700">amongagents</code>{" "}
          package). Truncated for readability — full prompts include complete map
          configuration, all room connections, and vent networks.
        </p>
      </section>
    </PageLayout>
  );
}
