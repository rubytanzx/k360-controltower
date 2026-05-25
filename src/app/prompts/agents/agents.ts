import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';

type AgentId = 'sher' | 'tor' | 'grum' | 'less' | 'lit' | 'sspa' | 'wbg' | 'isr';
type KptDomain = 'knowledge' | 'people' | 'tasks';
type Coverage = 'none' | 'partial' | 'full';
type FrictionTone = 'good' | 'warn' | 'bad' | 'neutral';

interface Subcategory {
  name: string;
  prompts: number;
  repeatRate: number;        // 0..100
  retrievalSuccess: number;  // 0..100 (renamed from sourceUtilisation)
  positivePct: number;
  negativePct: number;
  coverage: Coverage;
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

interface TopPrompt {
  text: string;
  count: number;
}

interface RegionBar {
  region: string;
  country?: string;
  pct: number;  // 0..100, bar length
}

interface CollectionUse {
  name: string;
  uses: number;
}

interface CollectionMatchCard {
  status: 'red' | 'amber' | 'green';
  label: string;
  sub: string;
  topCollections: CollectionUse[];
}

interface AgentFriction {
  repeatRate: string;
  repeatNote: string;
  clarificationCompare: string;
  clarificationTone: FrictionTone;
  clarificationLabel: string;
  collectionGap: string;
  collectionTone: FrictionTone;
}

interface AgentSummary {
  id: AgentId;
  domain: KptDomain;
  name: string;
  short: string;
  color: string;
  count: number;             // sessions (page views)
  uniqueVisitors: number;
  thumbsUp: number;
  thumbsDown: number;
  clarificationRate: number; // 0..1
  totalSecondary: string;    // card 1 secondary
  feedbackRegion: string;    // card 2 sub
  clarificationNote: string; // card 3 note
  collectionMatch: CollectionMatchCard;
  topPrompts: TopPrompt[];
  regionalDemand: RegionBar[];
  regionalCaption?: string;
  friction: AgentFriction;
  subcategories: Subcategory[];
  directional?: boolean;     // show * footnote when illustrative
}

@Component({
  selector: 'app-prompts-agents',
  imports: [TablerIconComponent, RouterLink],
  templateUrl: './agents.html',
  styleUrl: './agents.css',
})
export class AgentsAnalysis {
  // ---- KPT domain definitions ----
  readonly kptDomains: { id: KptDomain; label: string; color: string }[] = [
    { id: 'people',    label: 'People',    color: '#8B6FE8' },
    { id: 'knowledge', label: 'Knowledge', color: '#00C48C' },
    { id: 'tasks',     label: 'Tasks',     color: '#38BDF8' },
  ];

  private readonly domainOrder: Record<KptDomain, AgentId[]> = {
    people:    ['sher'],
    knowledge: ['less', 'lit', 'isr', 'sspa'],
    tasks:     ['tor', 'grum', 'wbg'],
  };

  readonly kptDomain = signal<KptDomain>('people');
  readonly active = signal<AgentId>('sher');

  readonly agents: AgentSummary[] = [
    // ===== People =====
    {
      id: 'sher', domain: 'people',
      name: 'Sherlock Expertise Detective', short: 'Sherlock',
      color: '#8B6FE8',
      count: 6992, uniqueVisitors: 2164,
      thumbsUp: 95, thumbsDown: 20, clarificationRate: 0.15,
      totalSecondary: '2,164 unique visitors — highest agent usage on the platform.',
      feedbackRegion: 'Highest feedback: ECA region.',
      clarificationNote: 'Sector specialists are well-defined; clarification rate is moderate vs platform.',
      collectionMatch: {
        status: 'amber',
        label: 'Expert profile coverage — gaps in climate finance and fragile states',
        sub: 'Expert Twin click-through below 15%.',
        topCollections: [
          { name: 'Sherlock Expert Database', uses: 4210 },
          { name: 'Expert Twin Profiles', uses: 1820 },
          { name: 'Staff Directory', uses: 962 },
        ],
      },
      topPrompts: [
        { text: 'Who has experience in pension reform in ECA?', count: 124 },
        { text: 'Who can peer review a payment system in LCR?', count: 96 },
        { text: 'Find operational expertise in implementing data collecting mechanisms', count: 74 },
        { text: 'Can you help me find experts in energy infrastructure development?', count: 58 },
        { text: 'Find operational expertise in fiscal policy reform in Ghana', count: 42 },
      ],
      regionalDemand: [
        { region: 'ECA', country: 'Poland', pct: 100 },
        { region: 'AFW', country: 'Ghana',  pct: 78 },
        { region: 'LCR',                    pct: 56 },
        { region: 'SAR', country: 'India',  pct: 40 },
        { region: 'Other',                  pct: 18 },
      ],
      friction: {
        repeatRate: '50%',
        repeatNote: 'Half of expertise queries are recurring — profile data may need enrichment.',
        clarificationCompare: '15% vs 50.54% platform average',
        clarificationTone: 'good',
        clarificationLabel: 'Well below average — clear intent',
        collectionGap: 'Sherlock active — profile enrichment needed',
        collectionTone: 'warn',
      },
      subcategories: [
        { name: 'Sector Specialists', prompts: 79, repeatRate: 52, retrievalSuccess: 82, positivePct: 75, negativePct: 15, coverage: 'partial' },
        { name: 'Country Experts',    prompts: 37, repeatRate: 48, retrievalSuccess: 88, positivePct: 82, negativePct: 10, coverage: 'partial' },
        { name: 'Operational Leads',  prompts: 31, repeatRate: 50, retrievalSuccess: 70, positivePct: 72, negativePct: 18, coverage: 'partial' },
        { name: 'External Network',   prompts: 22, repeatRate: 38, retrievalSuccess: 78, positivePct: 78, negativePct: 14, coverage: 'none' },
      ],
    },

    // ===== Knowledge =====
    {
      id: 'less', domain: 'knowledge',
      name: 'Lessons Explorer', short: 'Lessons',
      color: '#14b8a6',
      count: 2106, uniqueVisitors: 588,
      thumbsUp: 13, thumbsDown: 3, clarificationRate: 0.12,
      totalSecondary: '588 unique visitors — strong returning user base.',
      feedbackRegion: 'Highest feedback: AFW region.',
      clarificationNote: 'Lessons queries are typically focused with low clarification overhead.',
      collectionMatch: {
        status: 'green',
        label: '8,000+ ICRRs indexed — strong supply',
        sub: 'Lessons Learned database also integrated.',
        topCollections: [
          { name: 'ICRR Archive', uses: 1240 },
          { name: 'PPAR Database', uses: 620 },
          { name: 'Lessons Learned Database', uses: 246 },
        ],
      },
      topPrompts: [
        { text: 'What lessons have key design elements that contribute to effective education programs?', count: 38 },
        { text: 'Lessons from teacher training projects in Francophone West Africa', count: 22 },
        { text: 'What worked in agriculture interventions in West Africa?', count: 14 },
        { text: 'Lessons learned from past PFM reforms', count: 9 },
        { text: 'Implementation lessons from urban resilience projects', count: 7 },
      ],
      regionalDemand: [
        { region: 'AFW', country: 'Senegal', pct: 100 },
        { region: 'AFE', country: 'Kenya',   pct: 58 },
        { region: 'SAR',                     pct: 42 },
        { region: 'LCR',                     pct: 28 },
        { region: 'Other',                   pct: 18 },
      ],
      friction: {
        repeatRate: '24%',
        repeatNote: 'Low recurrence — content typically resolves the question.',
        clarificationCompare: '12% vs 50.54% platform average',
        clarificationTone: 'good',
        clarificationLabel: 'Well below average — strong content',
        collectionGap: 'Full coverage via ICRRs and PPARs',
        collectionTone: 'good',
      },
      subcategories: [
        { name: 'PFM Reforms',              prompts: 8, repeatRate: 22, retrievalSuccess: 80, positivePct: 78, negativePct: 12, coverage: 'full' },
        { name: 'Agriculture Interventions', prompts: 7, repeatRate: 26, retrievalSuccess: 76, positivePct: 75, negativePct: 15, coverage: 'full' },
        { name: 'Urban Resilience',          prompts: 6, repeatRate: 28, retrievalSuccess: 73, positivePct: 72, negativePct: 18, coverage: 'partial' },
        { name: 'Education Outcomes',        prompts: 5, repeatRate: 24, retrievalSuccess: 70, positivePct: 70, negativePct: 20, coverage: 'full' },
      ],
    },
    {
      id: 'lit', domain: 'knowledge',
      name: 'Literature Review and Policy Paper Generator', short: 'Lit. Review',
      color: '#f59e0b',
      count: 1184, uniqueVisitors: 412,
      thumbsUp: 11, thumbsDown: 3, clarificationRate: 0.18,
      totalSecondary: '412 unique visitors — moderate adoption.',
      feedbackRegion: 'Highest feedback: Global.',
      clarificationNote: 'Multi-source synthesis often needs scope refinement.',
      collectionMatch: {
        status: 'green',
        label: 'Multi-source synthesis — supply varies by topic',
        sub: 'Literature Review Generator covers most synthesis needs.',
        topCollections: [
          { name: 'Literature Review Generator', uses: 740 },
          { name: 'Cross-Source Synthesis DB', uses: 320 },
          { name: 'Research Question Library', uses: 124 },
        ],
      },
      topPrompts: [
        { text: 'Generate 10 research questions on financial systems and stability', count: 28 },
        { text: 'Please generate 10 prompts on these topics', count: 18 },
        { text: 'Summarise recent research on inflation projections', count: 11 },
        { text: 'Synthesise findings across recent climate finance reports', count: 9 },
        { text: 'Commodity Markets Outlook synthesis', count: 6 },
      ],
      regionalDemand: [
        { region: 'Global', pct: 100 },
        { region: 'AFW',    pct: 60 },
        { region: 'EAP',    pct: 50 },
        { region: 'ECA',    pct: 38 },
        { region: 'Other',  pct: 20 },
      ],
      friction: {
        repeatRate: '28%',
        repeatNote: 'Low recurrence — synthesis usually resolves the query.',
        clarificationCompare: '18% vs 50.54% platform average',
        clarificationTone: 'good',
        clarificationLabel: 'Well below average',
        collectionGap: 'Literature Review Generator covers most needs',
        collectionTone: 'good',
      },
      subcategories: [
        { name: 'Policy Research',       prompts: 10, repeatRate: 24, retrievalSuccess: 78, positivePct: 76, negativePct: 16, coverage: 'full' },
        { name: 'Literature Survey',     prompts:  7, repeatRate: 26, retrievalSuccess: 72, positivePct: 72, negativePct: 20, coverage: 'partial' },
        { name: 'Evidence Benchmarking', prompts:  5, repeatRate: 30, retrievalSuccess: 68, positivePct: 68, negativePct: 24, coverage: 'partial' },
      ],
    },
    {
      id: 'isr', domain: 'knowledge',
      name: 'ISR Issues Explorer', short: 'ISR',
      color: '#ef4444',
      count: 482, uniqueVisitors: 184,
      thumbsUp: 3, thumbsDown: 3, clarificationRate: 0.38,
      totalSecondary: '184 unique visitors — niche but operational.',
      feedbackRegion: 'Highest feedback: AFE region.',
      clarificationNote: 'ISR queries often surface ambiguous portfolio issues.',
      collectionMatch: {
        status: 'green',
        label: 'ISR database integrated — strong supply',
        sub: 'Direct integration with portfolio ISR records.',
        topCollections: [
          { name: 'ISR Portfolio Database', uses: 312 },
          { name: 'Project Risk Records', uses: 140 },
          { name: 'Implementation Status Reports', uses: 92 },
        ],
      },
      topPrompts: [
        { text: 'Surface project issues for the Q4 portfolio review', count: 9 },
        { text: 'What are the main implementation risks across active operations?', count: 6 },
        { text: 'List ISR-flagged projects in the energy sector', count: 4 },
        { text: 'Root-cause analysis for delayed disbursements', count: 3 },
        { text: 'Cross-cutting issues across AFW portfolio', count: 2 },
      ],
      regionalDemand: [
        { region: 'AFE',   pct: 100 },
        { region: 'AFW',   pct: 74 },
        { region: 'EAP',   pct: 52 },
        { region: 'LCR',   pct: 32 },
        { region: 'Other', pct: 18 },
      ],
      friction: {
        repeatRate: '42%',
        repeatNote: 'Recurring lookups on portfolio risk records.',
        clarificationCompare: '38% vs 50.54% platform average',
        clarificationTone: 'good',
        clarificationLabel: 'Slightly below average',
        collectionGap: 'ISR database — strong direct supply',
        collectionTone: 'good',
      },
      subcategories: [
        { name: 'Project Issues', prompts: 4, repeatRate: 44, retrievalSuccess: 55, positivePct: 55, negativePct: 35, coverage: 'full' },
        { name: 'Risk Analysis',  prompts: 3, repeatRate: 40, retrievalSuccess: 50, positivePct: 52, negativePct: 38, coverage: 'partial' },
        { name: 'Root Cause',     prompts: 1, repeatRate: 36, retrievalSuccess: 45, positivePct: 50, negativePct: 40, coverage: 'partial' },
      ],
    },
    {
      id: 'sspa', domain: 'knowledge',
      name: 'Self-Service Portfolio Analysis (SSPA)', short: 'SSPA',
      color: '#06b6d4',
      count: 814, uniqueVisitors: 244,
      thumbsUp: 8, thumbsDown: 2, clarificationRate: 0.14,
      totalSecondary: '244 unique visitors — concentrated power users.',
      feedbackRegion: 'Highest feedback: AFE region.',
      clarificationNote: 'Portfolio scope is usually well-defined.',
      collectionMatch: {
        status: 'amber',
        label: 'Portfolio data integrated — partial coverage',
        sub: 'SSPA active for portfolio queries; pipeline data partial.',
        topCollections: [
          { name: 'SSPA Portfolio DB', uses: 460 },
          { name: 'Project Pipeline Records', uses: 220 },
          { name: 'Operational Status Reports', uses: 110 },
        ],
      },
      topPrompts: [
        { text: 'Show me portfolio performance for AFW operations', count: 14 },
        { text: 'Compare pipeline volume across regions', count: 9 },
        { text: 'Project performance breakdown by sector', count: 6 },
        { text: 'Portfolio risk heatmap', count: 4 },
        { text: 'Active operations in fragile contexts', count: 3 },
      ],
      regionalDemand: [
        { region: 'AFE',   pct: 100 },
        { region: 'AFW',   pct: 80 },
        { region: 'EAP',   pct: 64 },
        { region: 'ECA',   pct: 42 },
        { region: 'Other', pct: 22 },
      ],
      friction: {
        repeatRate: '34%',
        repeatNote: 'Portfolio scope drives recurring drill-downs.',
        clarificationCompare: '14% vs 50.54% platform average',
        clarificationTone: 'good',
        clarificationLabel: 'Well below average',
        collectionGap: 'Portfolio data partial — pipeline gaps',
        collectionTone: 'warn',
      },
      subcategories: [
        { name: 'Portfolio Analysis',  prompts: 8, repeatRate: 36, retrievalSuccess: 82, positivePct: 80, negativePct: 12, coverage: 'partial' },
        { name: 'Project Performance', prompts: 4, repeatRate: 32, retrievalSuccess: 76, positivePct: 74, negativePct: 18, coverage: 'partial' },
        { name: 'Pipeline Review',     prompts: 2, repeatRate: 30, retrievalSuccess: 70, positivePct: 70, negativePct: 22, coverage: 'partial' },
      ],
    },

    // ===== Tasks =====
    {
      id: 'tor', domain: 'tasks',
      name: 'TOR Genie', short: 'TOR Genie',
      color: '#38BDF8',
      count: 14724, uniqueVisitors: 1242,
      thumbsUp: 25, thumbsDown: 7, clarificationRate: 0.62,
      totalSecondary: '1,242 unique visitors — highest task adoption.',
      feedbackRegion: 'Highest feedback: AFE region.',
      clarificationNote: 'Above-average clarification reflects users refining TOR scope.',
      collectionMatch: {
        status: 'green',
        label: '140,000+ TORs indexed — strong supply',
        sub: 'TOR Genie templates cover all major TOR types.',
        topCollections: [
          { name: 'TOR Library (140k+)', uses: 9420 },
          { name: 'TOR Genie Templates', uses: 3480 },
          { name: 'Project TOR Archive', uses: 1240 },
        ],
      },
      topPrompts: [
        { text: 'Generate a TOR for consulting services', count: 286 },
        { text: 'Generate a TOR for technical design supervision', count: 214 },
        { text: 'Generate a TOR related to energy infrastructure development', count: 192 },
        { text: 'Generate a TOR for a transportation specialist', count: 156 },
        { text: 'Generate a TOR for an infrastructure restoration analyst', count: 138 },
      ],
      regionalDemand: [
        { region: 'AFE', pct: 82 },
        { region: 'AFW', pct: 80 },
        { region: 'EAP', pct: 76 },
        { region: 'LCR', pct: 70 },
        { region: 'SAR', pct: 68 },
      ],
      regionalCaption: 'Global distribution — TOR generation is spread across all regions with no single dominant region.',
      friction: {
        repeatRate: '35%',
        repeatNote: 'Moderate repeat rate — diverse TOR types driving variation.',
        clarificationCompare: '62% vs 50.54% platform average',
        clarificationTone: 'good',
        clarificationLabel: 'Above average — users refining TOR scope',
        collectionGap: 'Full agent coverage via TOR Genie',
        collectionTone: 'good',
      },
      subcategories: [
        { name: 'Full TOR Draft',  prompts: 24, repeatRate: 34, retrievalSuccess: 80, positivePct: 78, negativePct: 14, coverage: 'full' },
        { name: 'Scope of Work',   prompts: 11, repeatRate: 38, retrievalSuccess: 75, positivePct: 72, negativePct: 18, coverage: 'full' },
        { name: 'M&E Framework',   prompts:  6, repeatRate: 32, retrievalSuccess: 70, positivePct: 68, negativePct: 22, coverage: 'full' },
        { name: 'Budget Template', prompts:  4, repeatRate: 28, retrievalSuccess: 65, positivePct: 65, negativePct: 25, coverage: 'partial' },
        { name: 'Other',           prompts:  2, repeatRate: 24, retrievalSuccess: 55, positivePct: 60, negativePct: 30, coverage: 'partial' },
      ],
    },
    {
      id: 'grum', domain: 'tasks',
      name: 'Grumpy Reviewer', short: 'Grumpy',
      color: '#f43f5e',
      count: 1648, uniqueVisitors: 412,
      thumbsUp: 14, thumbsDown: 8, clarificationRate: 0.30,
      totalSecondary: '412 unique visitors — review workflow driver.',
      feedbackRegion: 'Highest feedback: AFE region.',
      clarificationNote: 'Document review queries usually need scope confirmation.',
      collectionMatch: {
        status: 'green',
        label: 'Document review active — no collection dependency',
        sub: 'Operates on uploaded documents directly.',
        topCollections: [
          { name: 'Grumpy Reviewer Corpus', uses: 980 },
          { name: 'Uploaded Document Cache', uses: 480 },
          { name: 'Project Document Archive', uses: 188 },
        ],
      },
      topPrompts: [
        { text: 'Review this concept note for completeness', count: 38 },
        { text: 'Check this draft TOR for inconsistencies', count: 24 },
        { text: 'Quality check on the country brief', count: 18 },
        { text: 'Peer-review this implementation plan', count: 12 },
        { text: 'Identify gaps in the project appraisal', count: 8 },
      ],
      regionalDemand: [
        { region: 'AFE',   pct: 100 },
        { region: 'AFW',   pct: 72 },
        { region: 'EAP',   pct: 58 },
        { region: 'ECA',   pct: 40 },
        { region: 'Other', pct: 18 },
      ],
      friction: {
        repeatRate: '38%',
        repeatNote: 'Repeated review passes on the same documents.',
        clarificationCompare: '30% vs 50.54% platform average',
        clarificationTone: 'good',
        clarificationLabel: 'Below average — focused requests',
        collectionGap: 'No collection dependency — model-driven',
        collectionTone: 'good',
      },
      subcategories: [
        { name: 'Document Review', prompts: 14, repeatRate: 40, retrievalSuccess: 72, positivePct: 65, negativePct: 24, coverage: 'full' },
        { name: 'Quality Check',   prompts: 10, repeatRate: 36, retrievalSuccess: 68, positivePct: 62, negativePct: 28, coverage: 'full' },
        { name: 'Peer Review',     prompts:  7, repeatRate: 32, retrievalSuccess: 65, positivePct: 60, negativePct: 32, coverage: 'partial' },
      ],
    },
    {
      id: 'wbg', domain: 'tasks',
      name: 'WBG Translate Tool', short: 'Translate',
      color: '#8b5cf6',
      count: 962, uniqueVisitors: 248,
      thumbsUp: 7, thumbsDown: 1, clarificationRate: 0.10,
      totalSecondary: '248 unique visitors — utility workflow.',
      feedbackRegion: 'Highest feedback: LCR region.',
      clarificationNote: 'Translation queries are typically self-contained.',
      collectionMatch: {
        status: 'green',
        label: 'No collection dependency — language model only',
        sub: 'Model-driven, no retrieval required.',
        topCollections: [
          { name: 'Language Model (no collection)', uses: 962 },
          { name: 'Terminology Dictionary', uses: 168 },
          { name: 'Bank-Approved Style Guides', uses: 72 },
        ],
      },
      topPrompts: [
        { text: 'Translate this concept note into French', count: 38 },
        { text: 'Localize this country brief for the Polish audience', count: 22 },
        { text: 'Translate the executive summary into Spanish', count: 18 },
        { text: 'Translate the procurement notice into Portuguese', count: 11 },
        { text: 'Translate this policy paper into Hindi', count: 8 },
      ],
      regionalDemand: [
        { region: 'LCR',                    pct: 100 },
        { region: 'ECA', country: 'Poland', pct: 78 },
        { region: 'AFW',                    pct: 58 },
        { region: 'SAR', country: 'India',  pct: 42 },
        { region: 'Other',                  pct: 22 },
      ],
      friction: {
        repeatRate: '22%',
        repeatNote: 'Low recurrence — translation is one-shot.',
        clarificationCompare: '10% vs 50.54% platform average',
        clarificationTone: 'good',
        clarificationLabel: 'Well below average',
        collectionGap: 'No collection dependency required',
        collectionTone: 'good',
      },
      subcategories: [
        { name: 'Document Translation', prompts: 6, repeatRate: 22, retrievalSuccess: 85, positivePct: 85, negativePct: 10, coverage: 'full' },
        { name: 'Report Localization',  prompts: 3, repeatRate: 24, retrievalSuccess: 80, positivePct: 80, negativePct: 12, coverage: 'full' },
        { name: 'Other',                prompts: 2, repeatRate: 18, retrievalSuccess: 70, positivePct: 72, negativePct: 20, coverage: 'partial' },
      ],
    },
  ];

  constructor() {
    const route = inject(ActivatedRoute);
    const kptParam = route.snapshot.queryParamMap.get('kpt') as KptDomain | null;
    const agentParam = route.snapshot.queryParamMap.get('agent') as AgentId | null;

    let domain: KptDomain = 'people';
    let agent: AgentId = 'sher';

    if (kptParam && (kptParam === 'people' || kptParam === 'knowledge' || kptParam === 'tasks')) {
      domain = kptParam;
      agent = this.domainOrder[domain][0];
    }

    if (agentParam) {
      const found = this.agents.find((a) => a.id === agentParam);
      if (found) {
        domain = found.domain;
        agent = found.id;
      }
    }

    this.kptDomain.set(domain);
    this.active.set(agent);
  }

  setDomain(d: KptDomain) {
    this.kptDomain.set(d);
    this.active.set(this.domainOrder[d][0]);
  }

  setAgent(id: AgentId) {
    this.active.set(id);
  }

  readonly visibleAgents = computed(() =>
    this.domainOrder[this.kptDomain()]
      .map((id) => this.agents.find((a) => a.id === id))
      .filter((a): a is AgentSummary => !!a),
  );

  readonly current = computed(() =>
    this.agents.find((a) => a.id === this.active()) ?? this.agents[0],
  );

  readonly currentDomain = computed(() =>
    this.kptDomains.find((d) => d.id === this.kptDomain())!,
  );

  readonly sentimentPct = computed(() => {
    const a = this.current();
    const total = a.thumbsUp + a.thumbsDown;
    return total > 0 ? Math.round((a.thumbsUp / total) * 100) : 0;
  });

  readonly clarificationPct = computed(() =>
    Math.round(this.current().clarificationRate * 100),
  );

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
