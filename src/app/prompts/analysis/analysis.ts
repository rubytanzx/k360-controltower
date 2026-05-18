import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';

type TopicId = 'eg' | 'tor' | 'exp' | 'cli' | 'les' | 'hf' | 'oth';

interface Subcategory {
  name: string;
  prompts: number;
  sourceUtilisation: number; // 0..100
  positivePct: number;       // 0..100
  negativePct: number;       // 0..100
}

type FrictionType =
  | 'incorrect-content'
  | 'missing-depth'
  | 'source-gap'
  | 'format-mismatch'
  | 'routing-issue';

interface PromptRow {
  query: string;
  numQueries: number;
  feedbackUp: number;
  feedbackDown: number;
  feedbackComment: string;
  frictionType?: FrictionType;
}

interface TopicSummary {
  id: TopicId;
  name: string;
  short: string;
  color: string;
  count: number;
  thumbsUp: number;
  thumbsDown: number;
  clarificationRate: number; // 0..1
  subcategories: Subcategory[];
  trending?: boolean;
}

@Component({
  selector: 'app-prompts-analysis',
  imports: [TablerIconComponent, RouterLink],
  templateUrl: './analysis.html',
  styleUrl: './analysis.css',
})
export class Analysis {
  readonly topics: TopicSummary[] = [
    {
      id: 'eg',
      name: 'Economic Growth & Labor Markets',
      short: 'Economic Growth',
      color: '#2c8aff',
      count: 79,
      thumbsUp: 38,
      thumbsDown: 8,
      clarificationRate: 0.14,
      subcategories: [
        { name: 'GDP & Growth Trends',         prompts: 24, sourceUtilisation: 85, positivePct: 78, negativePct: 12 },
        { name: 'Labor Markets & Employment',  prompts: 18, sourceUtilisation: 78, positivePct: 75, negativePct: 14 },
        { name: 'Trade & Investment Flows',    prompts: 13, sourceUtilisation: 80, positivePct: 76, negativePct: 15 },
        { name: 'Inflation & Monetary Policy', prompts: 14, sourceUtilisation: 72, positivePct: 70, negativePct: 20 },
        { name: 'Productivity & Competitiveness', prompts: 10, sourceUtilisation: 65, positivePct: 68, negativePct: 22 },
      ],
    },
    {
      id: 'tor',
      name: 'TOR Generation',
      short: 'TOR Generation',
      color: '#a855f7',
      count: 47,
      thumbsUp: 22,
      thumbsDown: 6,
      clarificationRate: 0.21,
      subcategories: [
        { name: 'Project TORs',             prompts: 18, sourceUtilisation: 82, positivePct: 80, negativePct: 12 },
        { name: 'Consultant Scope of Work', prompts: 12, sourceUtilisation: 75, positivePct: 72, negativePct: 18 },
        { name: 'Technical Assistance TORs', prompts: 10, sourceUtilisation: 78, positivePct: 78, negativePct: 14 },
        { name: 'Evaluation TORs',          prompts: 7,  sourceUtilisation: 70, positivePct: 70, negativePct: 22 },
      ],
    },
    {
      id: 'exp',
      name: 'Expertise / People Search',
      short: 'Expertise',
      color: '#0ea5e9',
      count: 37,
      thumbsUp: 18,
      thumbsDown: 4,
      clarificationRate: 0.18,
      subcategories: [
        { name: 'Sector Specialists',  prompts: 14, sourceUtilisation: 88, positivePct: 82, negativePct: 10 },
        { name: 'Country Experts',     prompts: 11, sourceUtilisation: 84, positivePct: 80, negativePct: 12 },
        { name: 'Operational Leads',   prompts: 8,  sourceUtilisation: 80, positivePct: 78, negativePct: 13 },
        { name: 'External Network',    prompts: 4,  sourceUtilisation: 60, positivePct: 65, negativePct: 20 },
      ],
    },
    {
      id: 'cli',
      name: 'Climate & Infrastructure',
      short: 'Climate & Infra',
      color: '#22d3ee',
      count: 31,
      thumbsUp: 15,
      thumbsDown: 5,
      clarificationRate: 0.27,
      trending: true,
      subcategories: [
        { name: 'Climate Finance',          prompts: 12, sourceUtilisation: 70, positivePct: 75, negativePct: 18 },
        { name: 'Energy Transition',        prompts: 9,  sourceUtilisation: 68, positivePct: 72, negativePct: 20 },
        { name: 'Resilient Infrastructure', prompts: 6,  sourceUtilisation: 65, positivePct: 70, negativePct: 22 },
        { name: 'Adaptation Planning',      prompts: 4,  sourceUtilisation: 55, positivePct: 65, negativePct: 25 },
      ],
    },
    {
      id: 'les',
      name: 'Lessons Explorer',
      short: 'Lessons Explorer',
      color: '#14b8a6',
      count: 26,
      thumbsUp: 13,
      thumbsDown: 3,
      clarificationRate: 0.12,
      subcategories: [
        { name: 'Sector Lessons',         prompts: 11, sourceUtilisation: 80, positivePct: 78, negativePct: 12 },
        { name: 'Implementation Lessons', prompts: 8,  sourceUtilisation: 75, positivePct: 74, negativePct: 18 },
        { name: 'Regional Lessons',       prompts: 4,  sourceUtilisation: 72, positivePct: 72, negativePct: 20 },
        { name: 'Failed Operations',      prompts: 3,  sourceUtilisation: 60, positivePct: 65, negativePct: 30 },
      ],
    },
    {
      id: 'hf',
      name: 'Housing & Finance',
      short: 'Housing & Finance',
      color: '#ec4899',
      count: 22,
      thumbsUp: 11,
      thumbsDown: 2,
      clarificationRate: 0.16,
      subcategories: [
        { name: 'Affordable Housing',      prompts: 9, sourceUtilisation: 78, positivePct: 80, negativePct: 13 },
        { name: 'Mortgage Markets',        prompts: 8, sourceUtilisation: 76, positivePct: 78, negativePct: 15 },
        { name: 'Housing Finance Policy',  prompts: 5, sourceUtilisation: 72, positivePct: 75, negativePct: 18 },
      ],
    },
    {
      id: 'oth',
      name: 'Other',
      short: 'Other',
      color: '#f59e0b',
      count: 40,
      thumbsUp: 16,
      thumbsDown: 9,
      clarificationRate: 0.32,
      subcategories: [
        { name: 'Cross-Cutting Queries', prompts: 17, sourceUtilisation: 60, positivePct: 65, negativePct: 25 },
        { name: 'Operational Q&A',       prompts: 14, sourceUtilisation: 55, positivePct: 60, negativePct: 28 },
        { name: 'Unclassified',          prompts: 9,  sourceUtilisation: 40, positivePct: 55, negativePct: 35 },
      ],
    },
  ];

  readonly active = signal<TopicId>('eg');

  constructor() {
    const route = inject(ActivatedRoute);
    const t = route.snapshot.queryParamMap.get('topic') as TopicId | null;
    if (t && this.topics.some((x) => x.id === t)) {
      this.active.set(t);
    }
  }

  readonly current = computed(() =>
    this.topics.find((t) => t.id === this.active()) ?? this.topics[0],
  );

  readonly sentimentPct = computed(() => {
    const t = this.current();
    const total = t.thumbsUp + t.thumbsDown;
    return total > 0 ? Math.round((t.thumbsUp / total) * 100) : 0;
  });

  readonly clarificationPct = computed(() =>
    Math.round(this.current().clarificationRate * 100),
  );

  setTopic(id: TopicId) {
    this.active.set(id);
  }

  // ---- Subcategory drawer ----
  readonly drawerOpen = signal(false);
  readonly drawerSubcat = signal<Subcategory | null>(null);
  readonly drawerTab = signal<'prompts' | 'chat'>('prompts');
  readonly drawerExpanded = signal(false);
  readonly drawerWidth = signal(960);   // px, user-resizable
  readonly isResizing = signal(false);

  private resizeStartX = 0;
  private resizeStartWidth = 0;

  openDrawer(s: Subcategory) {
    this.drawerSubcat.set(s);
    this.drawerOpen.set(true);
    this.drawerTab.set('prompts');
    this.drawerExpanded.set(false);
  }

  closeDrawer() {
    this.drawerOpen.set(false);
    this.drawerExpanded.set(false);
  }

  toggleDrawerExpand() {
    this.drawerExpanded.update((v) => !v);
  }

  setDrawerTab(t: 'prompts' | 'chat') {
    this.drawerTab.set(t);
  }

  onResizeStart(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    // dragging exits the expanded state — the user is taking manual control
    this.drawerExpanded.set(false);
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = this.drawerWidth();
    this.isResizing.set(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }

  private readonly onResizeMove = (e: MouseEvent) => {
    if (!this.isResizing()) return;
    // drawer is right-anchored — dragging the left edge LEFT widens it
    const delta = this.resizeStartX - e.clientX;
    const max = Math.max(480, window.innerWidth - 80);
    const next = Math.max(420, Math.min(max, this.resizeStartWidth + delta));
    this.drawerWidth.set(next);
  };

  private readonly onResizeEnd = () => {
    this.isResizing.set(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  };

  aiSummary(): string {
    const s = this.drawerSubcat();
    if (!s) return '';
    return (
      `Prompts within ${s.name} focus on retrieving, interpreting, and synthesising ` +
      `World Bank Group knowledge for this domain. They typically ask the AI to surface ` +
      `key references, summarise relevant findings, compare approaches across ` +
      `regions or operations, and translate technical material into practical guidance. ` +
      `AI responses usually provide structured summaries, source citations, and ` +
      `recommendations to support analytical and operational decisions.`
    );
  }

  readonly mockPrompts: PromptRow[] = [
    {
      query: 'What are the key trends and challenges in this area over the past quarter?',
      numQueries: 14,
      feedbackUp: 2,
      feedbackDown: 12,
      feedbackComment: 'Response was high-level but missed the most recent reports…',
    },
    {
      query: 'Outline the approval process for project financing under USD 5 million.',
      numQueries: 8,
      feedbackUp: 0,
      feedbackDown: 8,
      feedbackComment: 'Project financing approval steps were incorrect for IDA…',
      frictionType: 'incorrect-content',
    },
    {
      query: 'What compliance controls apply to direct contracting under emergency operations?',
      numQueries: 7,
      feedbackUp: 1,
      feedbackDown: 6,
      feedbackComment: 'The Bank procurement controls only listed three of seven…',
      frictionType: 'missing-depth',
    },
    {
      query: 'What compliance controls apply to sole-source consultancy contracts?',
      numQueries: 5,
      feedbackUp: 1,
      feedbackDown: 4,
      feedbackComment: 'Direct contracting must cite OPCS guidance — source missing.',
      frictionType: 'source-gap',
    },
    {
      query: 'Summarise financial delegation limits across operational departments.',
      numQueries: 3,
      feedbackUp: 1,
      feedbackDown: 2,
      feedbackComment: 'Financial delegation limits should be a table, not prose.',
      frictionType: 'format-mismatch',
    },
    {
      query: 'Compare administrative instructions for HR vs Finance.',
      numQueries: 2,
      feedbackUp: 0,
      feedbackDown: 2,
      feedbackComment: 'Administrative instruction routing went to wrong domain agent.',
      frictionType: 'routing-issue',
    },
    {
      query: 'Administrative instructions for staff travel and entertainment.',
      numQueries: 2,
      feedbackUp: 0,
      feedbackDown: 2,
      feedbackComment: 'Administrative instructions routed to a stale TOR template.',
      frictionType: 'routing-issue',
    },
  ];

  frictionLabel(t: FrictionType): string {
    switch (t) {
      case 'incorrect-content': return 'Incorrect Content';
      case 'missing-depth':     return 'Missing Depth';
      case 'source-gap':        return 'Source Gap';
      case 'format-mismatch':   return 'Format Mismatch';
      case 'routing-issue':     return 'Routing Issue';
    }
  }
}
