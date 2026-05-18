import { Component, computed, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { FilterBar } from '../shared/filter-bar/filter-bar';

type SegmentId = 'focused' | 'power' | 'onetime' | 'low';
type Period = '30d' | '60d' | '90d';

interface SparkKpi {
  title: string;
  value: string;
  unit?: string;
  delta: string;
  deltaTone?: 'good' | 'bad';
}

interface ArcKpi {
  title: string;
  value: string;
  sub: string;
  arcPct: number;
}

interface Segment {
  id: SegmentId;
  name: string;
  pct: number;
  users: string;
}

interface ScatterDot {
  id: string;
  positions: Record<Period, { x: number; y: number }>;
}

@Component({
  selector: 'app-users',
  imports: [TablerIconComponent, FilterBar],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users {
  // ---- KPIs ----
  readonly uniqueActiveUsers: SparkKpi = {
    title: 'Unique Active Users',
    value: '223',
    unit: 'WBG staff',
    delta: '+12%',
  };

  readonly activeUsers: SparkKpi = {
    title: 'Active users trend',
    value: '5.4k',
    unit: 'sessions',
    delta: '+8%',
  };

  readonly adoption: ArcKpi = {
    title: 'Staff adoption rate',
    value: '2.5%',
    sub: 'of 9,000 staff',
    arcPct: 2.5,
  };

  readonly avgViews = {
    title: 'Avg K360 Views per User',
    value: '3.8',
    unit: 'views/user',
    delta: '+0.4',
    sub: 'target: >5/user/month',
  };

  readonly actionTakingUsers = {
    title: 'Action-Taking Users',
    value: '62%',
    delta: '+6pp',
    sub: 'of users acted on a result',
  };

  // ---- Behavioral Segmentation (segment definitions for summary panel) ----
  readonly segments: Segment[] = [
    { id: 'focused', name: 'Focused Users',       pct: 22, users: '1,265 Users' },
    { id: 'power',   name: 'Power Users',          pct: 4,  users: '230 Users'   },
    { id: 'onetime', name: 'One-Time Users',       pct: 45, users: '2,588 Users' },
    { id: 'low',     name: 'Low Engagement Users', pct: 26, users: '333 Users'   },
  ];

  readonly selectedSegment = signal<SegmentId | null>(null);

  selectSegment(id: SegmentId) {
    this.selectedSegment.update((cur) => (cur === id ? null : id));
  }

  readonly currentSegment = computed(() =>
    this.segments.find((s) => s.id === this.selectedSegment()) ?? null,
  );

  private readonly summaries: Record<SegmentId, string> = {
    focused:
      'Focused Users return regularly with short, purposeful sessions. They typically run 2–4 prompts ' +
      'per visit, mostly on Sherlock and TOR Genie, and rely on saved drafts and bookmarks. Action rate ' +
      'is well above average. Growth opportunity: surface advanced workflows (multi-agent synthesis, ' +
      'comparative analysis) to convert them into Power Users.',
    power:
      'Power Users drive the long tail of activity — high conversation count and high prompt intensity. ' +
      'They span multiple agents in a single session, frequently export to Word/PowerPoint, and provide ' +
      "the bulk of qualitative feedback. They are the platform's best signal for what to build next; " +
      'invest in feedback channels and early-access programs aimed at this cohort.',
    onetime:
      'One-Time Users visited K360 once and did not return. The largest segment by count, but the ' +
      'lowest by retention. Common patterns: ambiguous query intent, no result clicked, no follow-up ' +
      'prompt. Priority interventions: clearer onboarding, better empty-state guidance, and targeted ' +
      're-engagement when high-value content lands in their domain.',
    low:
      'Low Engagement Users opened sessions but ran few prompts and rarely acted on results. Often these ' +
      'are staff exploring the tool without a concrete task in mind. Consider lightweight prompts on ' +
      'home (curated starting points, example queries from their unit) to convert exploration into ' +
      'task-oriented use.',
  };

  readonly currentSummary = computed(() => {
    const id = this.selectedSegment();
    return id ? this.summaries[id] : null;
  });

  // ---- Scatter plot ----
  readonly periods: Period[] = ['30d', '60d', '90d'];
  readonly activePeriod = signal<Period>('30d');
  readonly hoveredDot = signal<string | null>(null);

  // SVG coordinate system
  readonly svgW = 420;
  readonly svgH = 280;
  readonly padL = 52;
  readonly padT = 16;
  readonly padR = 16;
  readonly padB = 40;
  readonly plotW = 352; // svgW - padL - padR
  readonly plotH = 224; // svgH - padT - padB
  // Quadrant threshold at (10, 10) on 0–20 data scale
  // svgQX = padL + (10/20)*plotW = 228
  // svgQY = padT + plotH - (10/20)*plotH = 128

  toSvgX(x: number): number { return this.padL + (x / 20) * this.plotW; }
  toSvgY(y: number): number { return this.padT + this.plotH - (y / 20) * this.plotH; }

  segOf(x: number, y: number): SegmentId {
    if (x >= 10 && y >= 10) return 'power';
    if (x <  10 && y >= 10) return 'focused';
    if (x <  10 && y <  10) return 'onetime';
    return 'low';
  }

  segColor(s: SegmentId): string {
    const m: Record<SegmentId, string> = {
      power:   '#14b8a6',
      focused: '#6366f1',
      onetime: '#a855f7',
      low:     '#fb923c',
    };
    return m[s];
  }

  segLabel(s: SegmentId): string {
    const m: Record<SegmentId, string> = {
      power:   'Power Users',
      focused: 'Focused Users',
      onetime: 'One-Time Users',
      low:     'Low Engagement',
    };
    return m[s];
  }

  readonly scatterDots: ScatterDot[] = [
    // Stable Power users (top-right)
    { id: 'p1',  positions: { '30d': {x:16,y:17}, '60d': {x:15,y:16}, '90d': {x:14,y:15} } },
    { id: 'p2',  positions: { '30d': {x:18,y:13}, '60d': {x:17,y:12}, '90d': {x:16,y:12} } },
    // Focused → Power migrants (accumulating conversations over time)
    { id: 'fp1', positions: { '30d': {x:13,y:15}, '60d': {x:9, y:14}, '90d': {x:6, y:13} } },
    { id: 'fp2', positions: { '30d': {x:12,y:12}, '60d': {x:8, y:11}, '90d': {x:5, y:10} } },
    // Stable Focused users (top-left)
    { id: 'f1',  positions: { '30d': {x:5, y:16}, '60d': {x:4, y:15}, '90d': {x:4, y:14} } },
    { id: 'f2',  positions: { '30d': {x:7, y:14}, '60d': {x:6, y:13}, '90d': {x:6, y:12} } },
    { id: 'f3',  positions: { '30d': {x:3, y:18}, '60d': {x:3, y:17}, '90d': {x:3, y:16} } },
    { id: 'f4',  positions: { '30d': {x:8, y:12}, '60d': {x:7, y:11}, '90d': {x:7, y:11} } },
    // One-Time → Focused migrants (increasing prompt depth over time)
    { id: 'of1', positions: { '30d': {x:4, y:11}, '60d': {x:4, y:7},  '90d': {x:3, y:3}  } },
    { id: 'of2', positions: { '30d': {x:6, y:10}, '60d': {x:5, y:6},  '90d': {x:5, y:2}  } },
    // Stable One-Time users (bottom-left cluster)
    { id: 'o1',  positions: { '30d': {x:2, y:3},  '60d': {x:2, y:3},  '90d': {x:2, y:3}  } },
    { id: 'o2',  positions: { '30d': {x:4, y:2},  '60d': {x:4, y:2},  '90d': {x:4, y:2}  } },
    { id: 'o3',  positions: { '30d': {x:1, y:5},  '60d': {x:1, y:5},  '90d': {x:1, y:5}  } },
    { id: 'o4',  positions: { '30d': {x:6, y:4},  '60d': {x:6, y:4},  '90d': {x:6, y:4}  } },
    { id: 'o5',  positions: { '30d': {x:3, y:7},  '60d': {x:3, y:7},  '90d': {x:3, y:7}  } },
    { id: 'o6',  positions: { '30d': {x:7, y:6},  '60d': {x:7, y:6},  '90d': {x:7, y:6}  } },
    { id: 'o7',  positions: { '30d': {x:2, y:8},  '60d': {x:2, y:8},  '90d': {x:2, y:8}  } },
    { id: 'o8',  positions: { '30d': {x:5, y:5},  '60d': {x:5, y:5},  '90d': {x:5, y:5}  } },
    // Stable Low Engagement users (bottom-right)
    { id: 'l1',  positions: { '30d': {x:13,y:5},  '60d': {x:12,y:4},  '90d': {x:12,y:4}  } },
    { id: 'l2',  positions: { '30d': {x:16,y:7},  '60d': {x:15,y:6},  '90d': {x:14,y:6}  } },
    { id: 'l3',  positions: { '30d': {x:12,y:3},  '60d': {x:11,y:3},  '90d': {x:11,y:3}  } },
    { id: 'l4',  positions: { '30d': {x:18,y:5},  '60d': {x:17,y:4},  '90d': {x:17,y:4}  } },
  ];

  readonly currentDots = computed(() => {
    const period = this.activePeriod();
    return this.scatterDots.map(d => {
      const pos = d.positions[period];
      const seg = this.segOf(pos.x, pos.y);
      return { id: d.id, cx: this.toSvgX(pos.x), cy: this.toSvgY(pos.y), seg, color: this.segColor(seg) };
    });
  });

  readonly prevPeriod = computed((): Period | null => {
    const p = this.activePeriod();
    return p === '30d' ? '60d' : p === '60d' ? '90d' : null;
  });

  readonly trailLines = computed(() => {
    const pp = this.prevPeriod();
    const curr = this.activePeriod();
    if (!pp) return [];
    return this.scatterDots
      .map(d => {
        const from = d.positions[pp];
        const to   = d.positions[curr];
        if (Math.abs(from.x - to.x) < 1 && Math.abs(from.y - to.y) < 1) return null;
        return {
          id:      d.id + '-trail',
          x1:      this.toSvgX(from.x),
          y1:      this.toSvgY(from.y),
          x2:      this.toSvgX(to.x),
          y2:      this.toSvgY(to.y),
          ghostCx: this.toSvgX(from.x),
          ghostCy: this.toSvgY(from.y),
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  });

  readonly hoveredDotData = computed(() => {
    const id = this.hoveredDot();
    if (!id) return null;
    return this.currentDots().find(d => d.id === id) ?? null;
  });

  // ---- helpers ----
  arcStroke(pct: number): { dash: string } {
    const C = 2 * Math.PI * 42;
    const filled = (pct / 100) * C;
    return { dash: `${filled} ${C}` };
  }
}
