import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { FilterBar } from '../shared/filter-bar/filter-bar';

type TopicId = 'eg' | 'tor' | 'exp' | 'cli' | 'les' | 'hf' | 'oth';
type Trend = 'up' | 'down' | 'stable';
type AgentId = 'sherlock' | 'torgenie' | 'lessons' | 'synthesis';

interface Topic {
  id: TopicId;
  name: string;
  count: number;
  pct: number;
  trend: Trend;
  color: string;
}

interface TreemapTopic {
  id: TopicId;
  name: string;
  pct: number;
  count: number;
  agent: AgentId;
  prompts: string[];
  trending?: boolean;
}

interface AgentLegend {
  id: AgentId;
  name: string;
}

interface ActionType {
  name: string;
  count: number;
  pct: number;
  icon: string;
  color: string;
}

interface UnitRow {
  name: string;
  /** counts per topic, same order as topics */
  counts: number[];
}

@Component({
  selector: 'app-prompts',
  imports: [TablerIconComponent, FilterBar, RouterLink],
  templateUrl: './prompts.html',
  styleUrl: './prompts.css',
})
export class Prompts {
  // ---- KPIs ----
  readonly totalPrompts = 282;
  readonly searchSuccessPct = 80;
  readonly promptsWithActionsPct = 34;
  readonly uniqueTopics = 7;

  // ---- Topic treemap (mirrors the landing-page Thematic Breakdown) ----
  readonly agents: AgentLegend[] = [
    { id: 'sherlock', name: 'Sherlock' },
    { id: 'torgenie', name: 'TOR Genie' },
    { id: 'lessons',  name: 'Lessons Explorer' },
    { id: 'synthesis', name: 'MultiAgent Synthesis' },
  ];

  readonly agentColor: Record<AgentId, string> = {
    sherlock: '#2c8aff',
    torgenie: '#a855f7',
    lessons: '#14b8a6',
    synthesis: '#f59e0b',
  };

  readonly treemap: TreemapTopic[][] = [
    [
      {
        id: 'eg',
        name: 'Economic Growth & Labor Markets',
        pct: 28,
        count: 79,
        agent: 'synthesis',
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
        agent: 'synthesis',
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

  readonly hoveredTopic = signal<TreemapTopic | null>(null);
  readonly rowFlex = (row: TreemapTopic[]) => row.reduce((s, t) => s + t.pct, 0);

  readonly aiSummary =
    'Prompts cluster into 7 themes this period. Economic Growth & Labor Markets leads with ' +
    '28% of volume, while Climate & Infrastructure is trending up as energy-transition and ' +
    'resilient-infra queries gain pace. TOR Generation is now the second largest driver of ' +
    'activity (17%), and Lessons Explorer holds steady around 9%. Open a tile to see the ' +
    'sub-topic breakdown and recent prompt feedback.';

  // ---- Topics ----
  readonly topics: Topic[] = [
    { id: 'eg',  name: 'Economic Growth & Labor Markets', count: 79, pct: 28, trend: 'up',     color: '#2c8aff' },
    { id: 'tor', name: 'TOR Generation',                  count: 47, pct: 17, trend: 'up',     color: '#a855f7' },
    { id: 'oth', name: 'Other',                           count: 40, pct: 14, trend: 'stable', color: '#f59e0b' },
    { id: 'exp', name: 'Expertise / People Search',       count: 37, pct: 13, trend: 'stable', color: '#0ea5e9' },
    { id: 'cli', name: 'Climate & Infrastructure',        count: 31, pct: 11, trend: 'up',     color: '#22d3ee' },
    { id: 'les', name: 'Lessons Explorer',                count: 26, pct:  9, trend: 'stable', color: '#14b8a6' },
    { id: 'hf',  name: 'Housing & Finance',               count: 22, pct:  8, trend: 'stable', color: '#ec4899' },
  ];

  // ---- Emerging themes time series ----
  readonly months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
  readonly emerging = [
    { id: 'eg',  name: 'Economic Growth',         data: [6, 8, 11, 14, 18, 22], color: '#2c8aff' },
    { id: 'tor', name: 'TOR Generation',          data: [5, 6, 7, 8, 10, 11],  color: '#a855f7' },
    { id: 'cli', name: 'Climate & Infrastructure',data: [2, 3, 4, 6, 8, 8],    color: '#22d3ee', trending: true },
    { id: 'les', name: 'Lessons Explorer',        data: [3, 4, 4, 5, 5, 5],    color: '#14b8a6' },
  ];

  // ---- Actions breakdown ----
  readonly actions: ActionType[] = [
    { name: 'Copied to clipboard', count: 43, pct: 45, icon: 'copy',        color: '#1ad6ff' },
    { name: 'Saved as Word',       count: 24, pct: 25, icon: 'file-export', color: '#2c8aff' },
    { name: 'Saved as PowerPoint', count: 17, pct: 18, icon: 'file-export', color: '#fb923c' },
    { name: 'Bookmarked',          count: 12, pct: 12, icon: 'star',        color: '#14b8a6' },
  ];

  // ---- Topic mix by unit ----
  // counts ordered by topics list above (eg, tor, oth, exp, cli, les, hf)
  readonly units: UnitRow[] = [
    { name: 'MTI',   counts: [38, 4,  5, 12, 4,  7, 9] },
    { name: 'FCI',   counts: [22, 6,  8, 8,  3,  5, 13] },
    { name: 'INFRA', counts: [10, 15, 12, 7, 18, 6, 0] },
    { name: 'HD',    counts: [5,  22, 12, 6, 3,  8, 0] },
    { name: 'POV',   counts: [4,  0,  3, 4,  3,  2, 0] },
  ];

  readonly unitRows = computed(() =>
    this.units.map((u) => {
      const total = u.counts.reduce((s, n) => s + n, 0);
      return {
        name: u.name,
        total,
        segments: u.counts.map((n, i) => ({
          pct: total > 0 ? (n / total) * 100 : 0,
          color: this.topics[i].color,
          name: this.topics[i].name,
          count: n,
        })),
      };
    }),
  );

  // ---- Multi-line chart paths ----
  readonly chartWidth = 720;
  readonly chartHeight = 240;
  private readonly maxVal = 25;

  private linePoints(data: number[]): { x: number; y: number }[] {
    const stepX = this.chartWidth / (data.length - 1);
    return data.map((v, i) => ({
      x: i * stepX,
      y: this.chartHeight - (v / this.maxVal) * (this.chartHeight - 30) - 15,
    }));
  }

  private smoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpx = (p0.x + p1.x) / 2;
      d += ` C ${cpx},${p0.y} ${cpx},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
  }

  readonly emergingPaths = computed(() =>
    this.emerging.map((line) => ({
      ...line,
      path: this.smoothPath(this.linePoints(line.data)),
      lastPoint: this.linePoints(line.data).slice(-1)[0],
    })),
  );
}
