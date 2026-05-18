import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { FilterBar } from '../shared/filter-bar/filter-bar';

type KpiVariant = 'sparkline' | 'arc' | 'placeholder' | 'status' | 'target' | 'uptime' | 'response';

interface Kpi {
  title: string;
  variant: KpiVariant;
  value?: string;
  unit?: string;
  delta?: string;
  sub?: string;
  placeholder?: string;
  icon?: string;
  arcPct?: number;
}

interface Agent {
  id: 'sherlock' | 'torgenie' | 'lessons' | 'synthesis';
  name: string;
  pct: number;
}

interface Topic {
  id: string;
  name: string;
  pct: number;
  count: number;
  agent: Agent['id'];
  prompts: string[];
  trending?: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [TablerIconComponent, FilterBar, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  // ---- row 1: KPI cards ----
  readonly kpis: Kpi[] = [
    {
      title: 'Total K360 Usage',
      variant: 'sparkline',
      value: '34,210',
      unit: 'queries',
      delta: '+18%',
      sub: 'overall usage volume',
    },
    {
      title: 'Estimated time saved',
      variant: 'target',
      value: '~1,400 hrs',
      sub: 'this month · across all agents',
    },
    {
      title: 'System Uptime',
      variant: 'uptime',
      value: '99.94%',
      sub: 'Availability',
      delta: '+0.20%',
    },
    {
      title: 'Avg Query Response Time',
      variant: 'response',
      value: '842',
      unit: 'ms',
      delta: '-9%',
      sub: 'median across all agents',
    },
  ];

  // ---- row 2: Agents + Ingested ----
  readonly agents: Agent[] = [
    { id: 'sherlock', name: 'Sherlock', pct: 45 },
    { id: 'torgenie', name: 'TOR Genie', pct: 28 },
    { id: 'lessons', name: 'Lessons Explorer', pct: 17 },
    { id: 'synthesis', name: 'MultiAgent Synthesis', pct: 10 },
  ];

  readonly ingested = {
    value: '2,302',
    delta: '+63% Past 30 days',
  };

  // ---- row 3: thematic treemap ----
  // Topics arranged in 2 rows by visual hierarchy; row height ∝ sum of pcts.
  readonly treemap: Topic[][] = [
    [
      {
        id: 'eg',
        name: 'Economic Growth & Labor Markets',
        pct: 28,
        count: 79,
        agent: 'sherlock',
        prompts: [
          'What are the latest labor market trends in MNA?',
          'Compare GDP growth across EAP middle-income countries',
          'Summarize recent inflation projections for SSA',
        ],
      },
      {
        id: 'tor',
        name: 'TOR Generation',
        pct: 17,
        count: 47,
        agent: 'torgenie',
        prompts: [
          'Draft a TOR for a public expenditure review in Kenya',
          'Generate scope of work for a private sector assessment',
          'TOR template for an education sector loan operation',
        ],
      },
      {
        id: 'oth',
        name: 'Other',
        pct: 14,
        count: 40,
        agent: 'synthesis',
        prompts: [
          'Ad-hoc cross-cutting queries',
          'Miscellaneous operational questions',
          'Unclassified or general inquiries',
        ],
      },
    ],
    [
      {
        id: 'exp',
        name: 'Expertise / People Search',
        pct: 13,
        count: 37,
        agent: 'sherlock',
        prompts: [
          'Who are our top experts on climate adaptation?',
          'Find specialists in digital ID systems',
          'Staff with experience in fragile-state operations',
        ],
      },
      {
        id: 'cli',
        name: 'Climate & Infrastructure',
        pct: 11,
        count: 31,
        agent: 'sherlock',
        trending: true,
        prompts: [
          'Compare climate finance flows by region',
          'Best practices for resilient transport infrastructure',
          'Energy transition strategy for coal-dependent economies',
        ],
      },
      {
        id: 'les',
        name: 'Lessons Explorer',
        pct: 9,
        count: 26,
        agent: 'lessons',
        prompts: [
          'Lessons learned from past PFM reforms',
          'What worked in agriculture interventions in West Africa?',
          'Implementation lessons from urban resilience projects',
        ],
      },
      {
        id: 'hf',
        name: 'Housing & Finance',
        pct: 8,
        count: 22,
        agent: 'sherlock',
        prompts: [
          'Housing finance markets in LAC',
          'Affordable housing policy frameworks',
          'Mortgage market development indicators',
        ],
      },
    ],
  ];

  readonly agentColor: Record<Agent['id'], string> = {
    sherlock: '#2c8aff',
    torgenie: '#a855f7',
    lessons: '#14b8a6',
    synthesis: '#f59e0b',
  };

  readonly hoveredTopic = signal<Topic | null>(null);

  readonly rowFlex = (row: Topic[]) => row.reduce((s, t) => s + t.pct, 0);

  // ---- rotating insights ----
  readonly insights = [
    'Climate finance queries increased 32% this month.',
    'TOR drafting is now the #2 AI workflow across all Global Practices.',
    'Cross-GP synthesis requests are rising in ECA and LAC.',
  ];
  readonly insightIndex = signal(0);

  constructor() {
    const id = setInterval(() => {
      this.insightIndex.update((i) => (i + 1) % this.insights.length);
    }, 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  // ---- helpers ----
  arcStroke(pct: number): { dash: string; offset: number } {
    // circumference for an r=42 arc → 2*pi*42 ≈ 263.9
    const C = 2 * Math.PI * 42;
    const filled = (pct / 100) * C;
    return { dash: `${filled} ${C}`, offset: 0 };
  }
}
