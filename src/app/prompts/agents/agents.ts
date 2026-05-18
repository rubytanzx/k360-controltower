import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';

type AgentId = 'sher' | 'tor' | 'grum' | 'less' | 'lit' | 'sspa' | 'wbg' | 'isr';

interface Subcategory {
  name: string;
  prompts: number;
  sourceUtilisation: number;
  positivePct: number;
  negativePct: number;
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
  relatedAgents: AgentId[];
}

interface AgentSummary {
  id: AgentId;
  name: string;
  short: string;
  color: string;
  count: number;
  thumbsUp: number;
  thumbsDown: number;
  clarificationRate: number;
  subcategories: Subcategory[];
}

@Component({
  selector: 'app-prompts-agents',
  imports: [TablerIconComponent, RouterLink],
  templateUrl: './agents.html',
  styleUrl: './agents.css',
})
export class AgentsAnalysis {
  readonly agents: AgentSummary[] = [
    {
      id: 'sher', name: 'Sherlock Expertise Detective', short: 'Sherlock',
      color: '#2c8aff', count: 169, thumbsUp: 95, thumbsDown: 20, clarificationRate: 0.15,
      subcategories: [
        { name: 'Economic Growth & Labor',   prompts: 79, sourceUtilisation: 82, positivePct: 75, negativePct: 15 },
        { name: 'People & Expertise Search', prompts: 37, sourceUtilisation: 88, positivePct: 82, negativePct: 10 },
        { name: 'Climate & Infrastructure',  prompts: 31, sourceUtilisation: 70, positivePct: 72, negativePct: 18 },
        { name: 'Housing & Finance',         prompts: 22, sourceUtilisation: 78, positivePct: 78, negativePct: 14 },
      ],
    },
    {
      id: 'tor', name: 'TOR Genie', short: 'TOR Genie',
      color: '#a855f7', count: 47, thumbsUp: 25, thumbsDown: 7, clarificationRate: 0.21,
      subcategories: [
        { name: 'Full TOR Draft',   prompts: 24, sourceUtilisation: 80, positivePct: 78, negativePct: 14 },
        { name: 'Scope of Work',    prompts: 11, sourceUtilisation: 75, positivePct: 72, negativePct: 18 },
        { name: 'M&E Framework',   prompts:  6, sourceUtilisation: 70, positivePct: 68, negativePct: 22 },
        { name: 'Budget Template',  prompts:  4, sourceUtilisation: 65, positivePct: 65, negativePct: 25 },
        { name: 'Other',            prompts:  2, sourceUtilisation: 55, positivePct: 60, negativePct: 30 },
      ],
    },
    {
      id: 'grum', name: 'Grumpy Reviewer', short: 'Grumpy',
      color: '#f43f5e', count: 31, thumbsUp: 14, thumbsDown: 8, clarificationRate: 0.30,
      subcategories: [
        { name: 'Document Review', prompts: 14, sourceUtilisation: 72, positivePct: 65, negativePct: 24 },
        { name: 'Quality Check',   prompts: 10, sourceUtilisation: 68, positivePct: 62, negativePct: 28 },
        { name: 'Peer Review',     prompts:  7, sourceUtilisation: 65, positivePct: 60, negativePct: 32 },
      ],
    },
    {
      id: 'less', name: 'Lessons Explorer', short: 'Lessons',
      color: '#14b8a6', count: 26, thumbsUp: 13, thumbsDown: 3, clarificationRate: 0.12,
      subcategories: [
        { name: 'PFM Reforms',              prompts:  8, sourceUtilisation: 80, positivePct: 78, negativePct: 12 },
        { name: 'Agriculture Interventions',prompts:  7, sourceUtilisation: 76, positivePct: 75, negativePct: 15 },
        { name: 'Urban Resilience',          prompts:  6, sourceUtilisation: 73, positivePct: 72, negativePct: 18 },
        { name: 'Education Outcomes',        prompts:  5, sourceUtilisation: 70, positivePct: 70, negativePct: 20 },
      ],
    },
    {
      id: 'lit', name: 'Literature Review and Policy Paper Generator', short: 'Lit. Review',
      color: '#f59e0b', count: 22, thumbsUp: 11, thumbsDown: 3, clarificationRate: 0.18,
      subcategories: [
        { name: 'Policy Research',       prompts: 10, sourceUtilisation: 78, positivePct: 76, negativePct: 16 },
        { name: 'Literature Survey',     prompts:  7, sourceUtilisation: 72, positivePct: 72, negativePct: 20 },
        { name: 'Evidence Benchmarking', prompts:  5, sourceUtilisation: 68, positivePct: 68, negativePct: 24 },
      ],
    },
    {
      id: 'sspa', name: 'Self-Service Portfolio Analysis (SSPA)', short: 'SSPA',
      color: '#06b6d4', count: 14, thumbsUp: 8, thumbsDown: 2, clarificationRate: 0.14,
      subcategories: [
        { name: 'Portfolio Analysis',  prompts: 8, sourceUtilisation: 82, positivePct: 80, negativePct: 12 },
        { name: 'Project Performance', prompts: 4, sourceUtilisation: 76, positivePct: 74, negativePct: 18 },
        { name: 'Pipeline Review',     prompts: 2, sourceUtilisation: 70, positivePct: 70, negativePct: 22 },
      ],
    },
    {
      id: 'wbg', name: 'WBG Translate Tool', short: 'Translate',
      color: '#8b5cf6', count: 11, thumbsUp: 7, thumbsDown: 1, clarificationRate: 0.10,
      subcategories: [
        { name: 'Document Translation', prompts: 6, sourceUtilisation: 85, positivePct: 85, negativePct: 10 },
        { name: 'Report Localization',  prompts: 3, sourceUtilisation: 80, positivePct: 80, negativePct: 12 },
        { name: 'Other',                prompts: 2, sourceUtilisation: 70, positivePct: 72, negativePct: 20 },
      ],
    },
    {
      id: 'isr', name: 'ISR Issues Explorer', short: 'ISR',
      color: '#ef4444', count: 8, thumbsUp: 3, thumbsDown: 3, clarificationRate: 0.38,
      subcategories: [
        { name: 'Project Issues', prompts: 4, sourceUtilisation: 55, positivePct: 55, negativePct: 35 },
        { name: 'Risk Analysis',  prompts: 3, sourceUtilisation: 50, positivePct: 52, negativePct: 38 },
        { name: 'Root Cause',     prompts: 1, sourceUtilisation: 45, positivePct: 50, negativePct: 40 },
      ],
    },
  ];

  readonly active = signal<AgentId>('sher');

  constructor() {
    const route = inject(ActivatedRoute);
    const a = route.snapshot.queryParamMap.get('agent') as AgentId | null;
    if (a && this.agents.some((x) => x.id === a)) {
      this.active.set(a);
    }
  }

  readonly current = computed(() =>
    this.agents.find((a) => a.id === this.active()) ?? this.agents[0],
  );

  readonly sentimentPct = computed(() => {
    const a = this.current();
    const total = a.thumbsUp + a.thumbsDown;
    return total > 0 ? Math.round((a.thumbsUp / total) * 100) : 0;
  });

  readonly clarificationPct = computed(() =>
    Math.round(this.current().clarificationRate * 100),
  );

  setAgent(id: AgentId) { this.active.set(id); }

  // ---- Subcategory drawer ----
  readonly drawerOpen = signal(false);
  readonly drawerSubcat = signal<Subcategory | null>(null);
  readonly drawerTab = signal<'prompts' | 'chat'>('prompts');
  readonly drawerExpanded = signal(false);
  readonly drawerWidth = signal(960);
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

  toggleDrawerExpand() { this.drawerExpanded.update((v) => !v); }
  setDrawerTab(t: 'prompts' | 'chat') { this.drawerTab.set(t); }

  onResizeStart(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
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
      `World Bank Group knowledge. They typically ask the AI to surface key references, ` +
      `summarise findings, compare approaches across regions, and translate technical ` +
      `material into practical guidance for analytical and operational decisions.`
    );
  }

  readonly mockPrompts: PromptRow[] = [
    {
      query: 'What are the key trends and challenges in this area over the past quarter?',
      numQueries: 14, feedbackUp: 2, feedbackDown: 12,
      feedbackComment: 'Response was high-level but missed the most recent reports…',
      relatedAgents: ['sher', 'less'],
    },
    {
      query: 'Outline the approval process for project financing under USD 5 million.',
      numQueries: 8, feedbackUp: 0, feedbackDown: 8,
      feedbackComment: 'Project financing approval steps were incorrect for IDA…',
      frictionType: 'incorrect-content',
      relatedAgents: ['sher', 'isr'],
    },
    {
      query: 'What compliance controls apply to direct contracting under emergency operations?',
      numQueries: 7, feedbackUp: 1, feedbackDown: 6,
      feedbackComment: 'The Bank procurement controls only listed three of seven…',
      frictionType: 'missing-depth',
      relatedAgents: ['sher', 'grum'],
    },
    {
      query: 'What compliance controls apply to sole-source consultancy contracts?',
      numQueries: 5, feedbackUp: 1, feedbackDown: 4,
      feedbackComment: 'Direct contracting must cite OPCS guidance — source missing.',
      frictionType: 'source-gap',
      relatedAgents: ['sher', 'tor'],
    },
    {
      query: 'Summarise financial delegation limits across operational departments.',
      numQueries: 3, feedbackUp: 1, feedbackDown: 2,
      feedbackComment: 'Financial delegation limits should be a table, not prose.',
      frictionType: 'format-mismatch',
      relatedAgents: ['sher', 'sspa'],
    },
    {
      query: 'Compare administrative instructions for HR vs Finance.',
      numQueries: 2, feedbackUp: 0, feedbackDown: 2,
      feedbackComment: 'Administrative instruction routing went to wrong domain agent.',
      frictionType: 'routing-issue',
      relatedAgents: ['sher', 'lit'],
    },
  ];

  agentChip(id: AgentId): { color: string; short: string } {
    const a = this.agents.find((x) => x.id === id);
    return a ? { color: a.color, short: a.short } : { color: '#888', short: id };
  }

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
