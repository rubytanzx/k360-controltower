import { Component, computed, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { FilterBar } from '../shared/filter-bar/filter-bar';

type SegmentId = 'focused' | 'power' | 'onetime' | 'low';

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

  // ---- Behavioral Segmentation Matrix ----
  readonly segments: Segment[] = [
    { id: 'focused', name: 'Focused Users', pct: 22, users: '1,265 Users' },
    { id: 'power', name: 'Power Users', pct: 4, users: '230 Users' },
    { id: 'onetime', name: 'One-Time Users', pct: 45, users: '2,588 Users' },
    { id: 'low', name: 'Low Engagement Users', pct: 26, users: '333 Users' },
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
      'Power Users drive the long tail of activity — high conversation count *and* high prompt intensity. ' +
      'They span multiple agents in a single session, frequently export to Word/PowerPoint, and provide ' +
      'the bulk of qualitative feedback. They are the platform’s best signal for what to build next; ' +
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

  // ---- helpers ----
  arcStroke(pct: number): { dash: string } {
    const C = 2 * Math.PI * 42;
    const filled = (pct / 100) * C;
    return { dash: `${filled} ${C}` };
  }
}
