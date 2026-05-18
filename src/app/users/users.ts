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

interface Persona {
  title: string;
  unit: string;
  avgConv: number;
  avgPrompts: number;
  primaryAgent: string;
  workflows: string[];
  exampleQuery: string;
  insight: string;
}

interface ScatterDot {
  id: string;
  positions: Record<Period, { x: number; y: number }>;
  persona: Persona;
}

@Component({
  selector: 'app-users',
  imports: [TablerIconComponent, FilterBar],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users {
  // ---- KPIs ----
  readonly uniqueActiveUsers: SparkKpi = { title: 'Unique Active Users', value: '223', unit: 'WBG staff', delta: '+12%' };
  readonly activeUsers: SparkKpi      = { title: 'Active users trend',   value: '5.4k', unit: 'sessions', delta: '+8%' };
  readonly adoption: ArcKpi           = { title: 'Staff adoption rate',  value: '2.5%', sub: 'of 9,000 staff', arcPct: 2.5 };
  readonly avgViews = { title: 'Avg K360 Views per User', value: '3.8', unit: 'views/user', delta: '+0.4', sub: 'target: >5/user/month' };
  readonly actionTakingUsers = { title: 'Action-Taking Users', value: '62%', delta: '+6pp', sub: 'of users acted on a result' };

  // ---- Segments (for legend + segment-level summary) ----
  readonly segments: Segment[] = [
    { id: 'focused', name: 'Focused Users',       pct: 22, users: '1,265 Users' },
    { id: 'power',   name: 'Power Users',          pct: 4,  users: '230 Users'   },
    { id: 'onetime', name: 'One-Time Users',       pct: 45, users: '2,588 Users' },
    { id: 'low',     name: 'Low Engagement Users', pct: 26, users: '333 Users'   },
  ];

  readonly selectedSegment = signal<SegmentId | null>(null);
  readonly selectedDot     = signal<string | null>(null);

  selectSegment(id: SegmentId) {
    this.selectedSegment.update(cur => cur === id ? null : id);
    this.selectedDot.set(null);
  }

  selectDot(id: string) {
    this.selectedDot.update(cur => cur === id ? null : id);
    this.selectedSegment.set(null);
  }

  readonly currentSegment = computed(() =>
    this.segments.find(s => s.id === this.selectedSegment()) ?? null,
  );

  readonly selectedDotSegment = computed((): SegmentId | null => {
    const id = this.selectedDot();
    if (!id) return null;
    return this.currentDots().find(d => d.id === id)?.seg ?? null;
  });

  readonly currentPersona = computed((): Persona | null => {
    const id = this.selectedDot();
    if (!id) return null;
    return this.scatterDots.find(d => d.id === id)?.persona ?? null;
  });

  private readonly summaries: Record<SegmentId, string> = {
    focused:
      'Focused Users return regularly with short, purposeful sessions. They typically run 2–4 prompts ' +
      'per visit and rely on saved drafts and bookmarks. Action rate is well above average. ' +
      'Growth opportunity: surface advanced workflows to convert them into Power Users.',
    power:
      "Power Users drive the long tail of activity — high conversation count and high prompt intensity. " +
      "They span multiple agents in a single session and provide the bulk of qualitative feedback. " +
      "They are the platform's best signal for what to build next.",
    onetime:
      'One-Time Users visited K360 once and did not return. Common patterns: ambiguous query intent, ' +
      'no result clicked, no follow-up prompt. Priority: clearer onboarding and targeted re-engagement.',
    low:
      'Low Engagement Users opened sessions but ran few prompts and rarely acted on results. ' +
      'Consider curated starting points and example queries from their unit to convert exploration into task-oriented use.',
  };

  readonly currentSummary = computed(() => {
    const id = this.selectedSegment();
    return id ? this.summaries[id] : null;
  });

  // ---- Scatter plot ----
  readonly periods: Period[] = ['30d', '60d', '90d'];
  readonly activePeriod = signal<Period>('30d');
  readonly hoveredDot   = signal<string | null>(null);

  readonly svgW = 420; readonly svgH = 280;
  readonly padL = 52;  readonly padT = 16;
  readonly padR = 16;  readonly padB = 40;
  readonly plotW = 352; readonly plotH = 224;

  toSvgX(x: number) { return this.padL + (x / 20) * this.plotW; }
  toSvgY(y: number) { return this.padT + this.plotH - (y / 20) * this.plotH; }

  segOf(x: number, y: number): SegmentId {
    if (x >= 10 && y >= 10) return 'power';
    if (x <  10 && y >= 10) return 'focused';
    if (x <  10 && y <  10) return 'onetime';
    return 'low';
  }

  segColor(s: SegmentId): string {
    return ({ power:'#14b8a6', focused:'#6366f1', onetime:'#a855f7', low:'#fb923c' })[s];
  }

  segLabel(s: SegmentId): string {
    return ({ power:'Power Users', focused:'Focused Users', onetime:'One-Time Users', low:'Low Engagement' })[s];
  }

  readonly scatterDots: ScatterDot[] = [
    {
      id: 'p1',
      positions: { '30d': {x:16,y:17}, '60d': {x:15,y:16}, '90d': {x:14,y:15} },
      persona: {
        title: 'Task Team Leader (TTL)',
        unit: 'Infrastructure & Urban Development · EAP',
        avgConv: 16, avgPrompts: 17, primaryAgent: 'TOR Genie',
        workflows: ['TOR drafting & revision', 'Country economic context', 'Policy framework lookup'],
        exampleQuery: 'Draft a TOR for an urban resilience project in Vietnam with a $50M IDA envelope',
        insight: 'High-volume, high-intensity user. Runs multi-step sessions spanning TOR drafting, economic background, and compliance checks in a single sitting. Highest action rate on the platform.',
      },
    },
    {
      id: 'p2',
      positions: { '30d': {x:18,y:13}, '60d': {x:17,y:12}, '90d': {x:16,y:12} },
      persona: {
        title: 'Senior Macro Economist',
        unit: 'Macroeconomics, Trade & Investment (MTI) · MNA',
        avgConv: 18, avgPrompts: 13, primaryAgent: 'Sherlock',
        workflows: ['Cross-country GDP comparisons', 'Inflation & labour market analysis', 'Synthesis across WDR & flagship reports'],
        exampleQuery: 'Compare inflation trajectories in Egypt, Morocco, and Tunisia post-2022 with IMF projections',
        insight: 'Research-driven power user who chains multiple analytical prompts per session. Frequently cites and exports findings directly to policy notes and briefs.',
      },
    },
    {
      id: 'fp1',
      positions: { '30d': {x:13,y:15}, '60d': {x:9,y:14}, '90d': {x:6,y:13} },
      persona: {
        title: 'Investment Officer (IFC)',
        unit: 'Finance, Competitiveness & Innovation · LAC',
        avgConv: 13, avgPrompts: 15, primaryAgent: 'Lessons Explorer',
        workflows: ['Private sector market analysis', 'IFC portfolio performance review', 'Deal context & comparables'],
        exampleQuery: 'What are lessons from IFC fintech investments in Sub-Saharan Africa over the past 5 years?',
        insight: 'Rapidly increasing usage as K360 proves value for deal diligence and lessons. Projected to enter the Power User quadrant in the next cycle.',
      },
    },
    {
      id: 'fp2',
      positions: { '30d': {x:12,y:12}, '60d': {x:8,y:11}, '90d': {x:5,y:10} },
      persona: {
        title: 'Climate & Infrastructure Specialist',
        unit: 'Environment & Natural Resources · ECA',
        avgConv: 12, avgPrompts: 12, primaryAgent: 'MultiAgent Synthesis',
        workflows: ['Climate finance flow analysis', 'Energy transition strategy', 'Resilient infrastructure benchmarks'],
        exampleQuery: 'Summarise best practices for coal transition financing in Central Asia',
        insight: 'Usage growing in line with the expanded climate mandate. Multi-agent synthesis is the primary draw — sessions increasingly span multiple knowledge domains.',
      },
    },
    {
      id: 'f1',
      positions: { '30d': {x:5,y:16}, '60d': {x:4,y:15}, '90d': {x:4,y:14} },
      persona: {
        title: 'Research Analyst',
        unit: 'Development Economics (DEC) · Global',
        avgConv: 5, avgPrompts: 16, primaryAgent: 'Sherlock',
        workflows: ['Deep literature search', 'Citation coverage review', 'Poverty & welfare data synthesis'],
        exampleQuery: 'Find peer-reviewed sources on the impact of social protection on labour supply in LMICs',
        insight: 'Low-frequency but very high-intensity sessions. Runs 10–20 prompts per sitting focused on evidence synthesis, typically for WDR or flagship report chapters.',
      },
    },
    {
      id: 'f2',
      positions: { '30d': {x:7,y:14}, '60d': {x:6,y:13}, '90d': {x:6,y:12} },
      persona: {
        title: 'Portfolio Officer',
        unit: 'Operations Policy & Country Services (OPCS)',
        avgConv: 7, avgPrompts: 14, primaryAgent: 'Sherlock',
        workflows: ['Portfolio performance queries', 'Project risk flagging', 'Operational policy lookup'],
        exampleQuery: 'Which active projects in AFR have overdue ISRs and what are the common risk themes?',
        insight: 'Focused sessions oriented around specific portfolio tasks. Action rate is very high — most queries end with a document export or decision note.',
      },
    },
    {
      id: 'f3',
      positions: { '30d': {x:3,y:18}, '60d': {x:3,y:17}, '90d': {x:3,y:16} },
      persona: {
        title: 'Country Economist',
        unit: 'Poverty & Equity · Sub-Saharan Africa (AFR)',
        avgConv: 3, avgPrompts: 18, primaryAgent: 'Sherlock',
        workflows: ['Country macro deep-dives', 'Poverty data comparisons', 'CEM / SCD background research'],
        exampleQuery: 'Pull the latest poverty headcount data for Ethiopia and compare with SSA regional averages',
        insight: 'Highest prompt-per-session ratio on the platform. Runs marathon research sessions anchored to a Country Economic Memorandum or Systematic Country Diagnostic deliverable.',
      },
    },
    {
      id: 'f4',
      positions: { '30d': {x:8,y:12}, '60d': {x:7,y:11}, '90d': {x:7,y:11} },
      persona: {
        title: 'Practice Manager',
        unit: 'Human Development · SAR',
        avgConv: 8, avgPrompts: 12, primaryAgent: 'MultiAgent Synthesis',
        workflows: ['Cross-GP synthesis', 'Team performance overview', 'Strategic planning inputs'],
        exampleQuery: 'Synthesise findings across HD and education lending in South Asia for the past 3 years',
        insight: 'Uses K360 primarily for synthesis tasks ahead of management reviews. Sessions are purposeful and time-boxed; rarely re-runs a query.',
      },
    },
    {
      id: 'of1',
      positions: { '30d': {x:4,y:11}, '60d': {x:4,y:7}, '90d': {x:3,y:3} },
      persona: {
        title: 'Operations Officer',
        unit: 'Country Operations · ECA',
        avgConv: 4, avgPrompts: 11, primaryAgent: 'TOR Genie',
        workflows: ['Operational guidance lookup', 'Fiduciary compliance checks', 'Project preparation support'],
        exampleQuery: 'What are the procurement requirements for a community-driven development project under OP 4.12?',
        insight: 'Recent convert from one-time visitor. Started using K360 for fiduciary queries and is now exploring TOR drafting. Engagement growing steadily — watch for transition into the Focused segment.',
      },
    },
    {
      id: 'of2',
      positions: { '30d': {x:6,y:10}, '60d': {x:5,y:6}, '90d': {x:5,y:2} },
      persona: {
        title: 'Young Professional (YP) / Junior Economist',
        unit: 'Macroeconomics, Trade & Investment · Global',
        avgConv: 6, avgPrompts: 10, primaryAgent: 'Sherlock',
        workflows: ['Background research for senior staff', 'Data table construction', 'Literature review support'],
        exampleQuery: 'Summarise IMF Article IV findings for Indonesia, Philippines, and Vietnam in 2024',
        insight: 'Building K360 habits through repeated use for research briefs. Strong candidate for the Focused User segment — targeted prompts from their unit would accelerate progression.',
      },
    },
    {
      id: 'o1',
      positions: { '30d': {x:2,y:3}, '60d': {x:2,y:3}, '90d': {x:2,y:3} },
      persona: {
        title: 'Administrative Assistant',
        unit: 'Country Office · Kenya',
        avgConv: 2, avgPrompts: 3, primaryAgent: 'Sherlock',
        workflows: ['General document lookup', 'Meeting preparation'],
        exampleQuery: 'Where can I find the standard consulting contract template?',
        insight: 'Single-session user who arrived via a team referral for a specific document lookup. K360 is not aligned to core daily workflows for this role.',
      },
    },
    {
      id: 'o2',
      positions: { '30d': {x:4,y:2}, '60d': {x:4,y:2}, '90d': {x:4,y:2} },
      persona: {
        title: 'HR Officer',
        unit: 'Human Resources · Washington DC',
        avgConv: 4, avgPrompts: 2, primaryAgent: 'Sherlock',
        workflows: ['Staff policy lookup'],
        exampleQuery: 'What is the parental leave policy for locally hired staff?',
        insight: 'Used K360 once for an HR policy question that could have been resolved via the staff portal. Platform not well-suited to this persona\'s core workflows.',
      },
    },
    {
      id: 'o3',
      positions: { '30d': {x:1,y:5}, '60d': {x:1,y:5}, '90d': {x:1,y:5} },
      persona: {
        title: 'Procurement Officer',
        unit: 'Corporate Procurement · Global',
        avgConv: 1, avgPrompts: 5, primaryAgent: 'Sherlock',
        workflows: ['Procurement regulation lookup'],
        exampleQuery: 'Summarise OP/BP 4.00 procurement requirements for consulting firms',
        insight: 'High prompt count for a single session — engaged once, deeply, but did not return. Possible value fit for policy lookups if re-engaged with targeted content.',
      },
    },
    {
      id: 'o4',
      positions: { '30d': {x:6,y:4}, '60d': {x:6,y:4}, '90d': {x:6,y:4} },
      persona: {
        title: 'Finance Officer',
        unit: 'Corporate Finance · Washington DC',
        avgConv: 6, avgPrompts: 4, primaryAgent: 'Sherlock',
        workflows: ['Budget policy lookup', 'Expense guideline queries'],
        exampleQuery: 'What are the allowable expenses for mission travel under the Admin Manual?',
        insight: "One-time user for an administrative finance query. K360's value proposition for routine finance questions remains unclear without a dedicated finance knowledge collection.",
      },
    },
    {
      id: 'o5',
      positions: { '30d': {x:3,y:7}, '60d': {x:3,y:7}, '90d': {x:3,y:7} },
      persona: {
        title: 'Communications Officer',
        unit: 'External & Corporate Relations · EAP',
        avgConv: 3, avgPrompts: 7, primaryAgent: 'Sherlock',
        workflows: ['Press release background research', 'Project results storytelling'],
        exampleQuery: 'Find key results from WB infrastructure projects in Indonesia for a press release',
        insight: 'Tried K360 for content research with moderate prompt depth. Did not return — outputs likely required significant editing to meet communications standards.',
      },
    },
    {
      id: 'o6',
      positions: { '30d': {x:7,y:6}, '60d': {x:7,y:6}, '90d': {x:7,y:6} },
      persona: {
        title: 'IT Support Specialist',
        unit: 'World Bank Technology · Global',
        avgConv: 7, avgPrompts: 6, primaryAgent: 'Sherlock',
        workflows: ['Internal documentation search'],
        exampleQuery: 'What is the data classification policy for sharing operational documents externally?',
        insight: 'Single exploratory visit for an internal IT policy query. K360 is not the right fit for IT-specific or infrastructure documentation needs.',
      },
    },
    {
      id: 'o7',
      positions: { '30d': {x:2,y:8}, '60d': {x:2,y:8}, '90d': {x:2,y:8} },
      persona: {
        title: 'Short-Term Consultant (STC)',
        unit: 'Governance · LAC',
        avgConv: 2, avgPrompts: 8, primaryAgent: 'Lessons Explorer',
        workflows: ['Project lessons lookup', 'Rapid background research'],
        exampleQuery: 'What are lessons from public financial management reforms in Latin America?',
        insight: 'Engaged deeply for a specific assignment. High prompt depth for a one-time user — likely found value but engagement ended with the contract.',
      },
    },
    {
      id: 'o8',
      positions: { '30d': {x:5,y:5}, '60d': {x:5,y:5}, '90d': {x:5,y:5} },
      persona: {
        title: 'Junior Professional Officer (JPO)',
        unit: 'Agriculture & Food · AFR',
        avgConv: 5, avgPrompts: 5, primaryAgent: 'Sherlock',
        workflows: ['Sector background reading', 'Early career exploration'],
        exampleQuery: 'Give me an overview of WB agricultural projects in West Africa',
        insight: 'Initial exploration visit. Promising re-engagement candidate — targeted onboarding with sector-specific prompts would likely convert this persona to a Focused User.',
      },
    },
    {
      id: 'l1',
      positions: { '30d': {x:13,y:5}, '60d': {x:12,y:4}, '90d': {x:12,y:4} },
      persona: {
        title: 'Country Manager',
        unit: 'Country Management · Ghana',
        avgConv: 13, avgPrompts: 5, primaryAgent: 'Sherlock',
        workflows: ['High-level country overview', 'Portfolio status checks'],
        exampleQuery: 'What is the current status of our active portfolio in Ghana?',
        insight: 'Logs in frequently but delegates deep research to team members. Sessions are brief check-ins rather than substantive queries — high frequency, low depth.',
      },
    },
    {
      id: 'l2',
      positions: { '30d': {x:16,y:7}, '60d': {x:15,y:6}, '90d': {x:14,y:6} },
      persona: {
        title: 'Regional Coordinator',
        unit: 'Operations · SAR Regional Hub',
        avgConv: 16, avgPrompts: 7, primaryAgent: 'Sherlock',
        workflows: ['Cross-country coordination queries', 'Meeting preparation'],
        exampleQuery: 'List active projects across SAR with flagged implementation issues',
        insight: 'High login frequency, low prompt depth. Uses K360 as a quick reference tool rather than an analytical platform. A structured dashboard view would serve this persona better.',
      },
    },
    {
      id: 'l3',
      positions: { '30d': {x:12,y:3}, '60d': {x:11,y:3}, '90d': {x:11,y:3} },
      persona: {
        title: 'Operations Analyst',
        unit: 'Country Operations · MNA',
        avgConv: 12, avgPrompts: 3, primaryAgent: 'Sherlock',
        workflows: ['Operational reporting', 'Routine compliance checks'],
        exampleQuery: 'What reporting is required for a $200M DPL in the MNA region?',
        insight: 'Frequent but shallow engagement driven by routine operational queries. Consider whether structured templates would serve this workflow better than open-ended AI queries.',
      },
    },
    {
      id: 'l4',
      positions: { '30d': {x:18,y:5}, '60d': {x:17,y:4}, '90d': {x:17,y:4} },
      persona: {
        title: 'Sector Unit Assistant',
        unit: 'Energy & Extractives · ECA',
        avgConv: 18, avgPrompts: 5, primaryAgent: 'Sherlock',
        workflows: ['Document filing support', 'Quick document retrieval'],
        exampleQuery: 'Find the latest energy sector strategy document for Central Asia',
        insight: 'Very high session count but consistently shallow queries dominated by administrative tasks. Evaluate whether K360 is the appropriate tool for this workflow.',
      },
    },
  ];

  readonly currentDots = computed(() => {
    const period = this.activePeriod();
    return this.scatterDots.map(d => {
      const pos = d.positions[period];
      const seg = this.segOf(pos.x, pos.y);
      return {
        id: d.id,
        cx: this.toSvgX(pos.x),
        cy: this.toSvgY(pos.y),
        seg,
        color: this.segColor(seg),
        personaTitle: d.persona.title,
      };
    });
  });

  readonly prevPeriod = computed((): Period | null => {
    const p = this.activePeriod();
    return p === '30d' ? '60d' : p === '60d' ? '90d' : null;
  });

  readonly trailLines = computed(() => {
    const pp  = this.prevPeriod();
    const cur = this.activePeriod();
    if (!pp) return [];
    return this.scatterDots
      .map(d => {
        const from = d.positions[pp];
        const to   = d.positions[cur];
        if (Math.abs(from.x - to.x) < 1 && Math.abs(from.y - to.y) < 1) return null;
        return {
          id:      d.id + '-trail',
          x1:      this.toSvgX(from.x), y1: this.toSvgY(from.y),
          x2:      this.toSvgX(to.x),   y2: this.toSvgY(to.y),
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
    return { dash: `${(pct / 100) * C} ${C}` };
  }
}
