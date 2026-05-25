import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { HierFilter } from '../shared/hier-filter/hier-filter';
import {
  REGION_GROUPS, VPU_GROUPS, regionCountrySelectionFromParams,
} from '../shared/hier-filter/hier-filter-catalog';
import { DateRangeFilter } from '../shared/date-range-filter/date-range-filter';

type KptTab = 'knowledge' | 'people' | 'tasks';
type TmMode = 'volume' | 'repeat';
type Workspace = 'wb' | 'ifc';
type FrictionDomain = 'knowledge' | 'people' | 'task';
type FrictionDirection = 'up' | 'down';
type FrictionMetricIcon = 'thumbs-down' | 'arrow-up' | 'arrow-down' | 'none';

/** What kind of friction this signal represents — drives the headline metric + tone. */
type FrictionKind =
  | 'dislike'         // High share of dislikes on the answer
  | 'clarify'         // Users re-asking with corrected intent
  | 'low-expert'      // People search returning few / dropping expert visits
  | 'low-download'    // Task output not being saved / downloaded
  | 'outdated';       // Sources cited are outdated / superseded

interface KpiMetric { value: string; label?: string; delta?: string; }
interface PageKpi   { title: string; metrics: KpiMetric[]; sub?: string; }

interface TreemapTopic {
  id: string;
  name: string;
  pct: number;
  count: number;
  color: string;
  trending?: boolean;
  prompts?: string[];
}

interface FrictionSignal {
  domain: FrictionDomain;
  topic: string;
  /** Topic id used to navigate to the category detail page. */
  topicId: string;
  kind: FrictionKind;
  /** Headline friction metric value (e.g. 75, 32, 18). */
  metricValue: number;
  /** Unit / suffix appended to the value (e.g. "%", "" for raw counts). */
  metricUnit: string;
  /** Plain-language description of what the metric measures. */
  metricCaption: string;
  /** Volume context: count of prompts/searches/generations behind the signal. */
  volume: number;
  volumeLabel: string; // e.g. "prompts", "searches", "generations"
  /** Direction of change vs. prior period. */
  direction: FrictionDirection;
  changePct: number;
}

@Component({
  selector: 'app-prompts',
  imports: [TablerIconComponent, RouterLink, HierFilter, DateRangeFilter],
  templateUrl: './prompts.html',
  styleUrl: './prompts.css',
})
export class Prompts {
  // ---- Workspace toggle (WB / IFC) ----
  readonly workspace = signal<Workspace>('wb');
  setWorkspace(w: Workspace) { this.workspace.set(w); }

  // ---- Hierarchical filter catalogs ----
  readonly regionGroups = REGION_GROUPS;
  readonly vpuGroups    = VPU_GROUPS;

  /** Pre-applied Region/Country from the URL — set when the user arrives from
   *  the dashboard country drawer's "View Prompts" link (?country=ke or
   *  ?region=afe). Empty otherwise. */
  readonly initialRegionCountry = (() => {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    return regionCountrySelectionFromParams({ region: q.get('region'), country: q.get('country') });
  })();

  // ---- KPI row — anchored to K360 Master Data Extract ----
  // Adobe Analytics (Dec 1 – Jan 2): 639 chat prompts, 450 unique.
  // Power BI (Jan 1 – May 19): 3,095 unique visitors / 2,923 repeat / 16.73% adoption.
  readonly pageKpis: PageKpi[] = [
    { title: 'Total No. of Prompts',         metrics: [{ value: '639',   delta: '+12%' }], sub: '450 unique prompts' },
    { title: 'Staff Adoption Rate',          metrics: [{ value: '17%',   delta: '+2.4pp' }], sub: 'target: 50% by Dec 2026' },
    { title: 'New vs Returning Users',       metrics: [
      { value: '172',   label: 'new' },
      { value: '2,923', label: 'returning' },
    ] },
    { title: 'Average K360 Views per User',  metrics: [{ value: '3',     delta: '+0.4' }] },
    { title: 'Exploration Depth',            metrics: [{ value: '3.2',   delta: '+0.3' }], sub: 'page views per session' },
  ];

  // ---- KPT tabs for the treemap section ----
  readonly kptTabDefs = [
    { id: 'knowledge' as KptTab, label: 'Knowledge' },
    { id: 'people' as KptTab, label: 'People' },
    { id: 'tasks' as KptTab, label: 'Tasks' },
  ];
  readonly activeTab = signal<KptTab>('knowledge');
  readonly hoveredTopic = signal<TreemapTopic | null>(null);

  // ---- Toggle: By Volume / By Repeat Rate ----
  readonly tmMode = signal<TmMode>('volume');
  setTmMode(m: TmMode) { this.tmMode.set(m); }

  // ---- Treemap data (one matrix per tab) ----
  private readonly knowledgeByVolume: TreemapTopic[][] = [
    [
      { id: 'eg',  name: 'Macroeconomic Research',     pct: 28, count: 79, color: '#2c8aff',
        prompts: ['What are the latest GDP trends for Ghana?', 'Compare poverty indicators across Ghana regions', 'Summarize World Bank projects in Ghana 2022–2024'] },
      { id: 'ml',  name: 'Labor & Social Policy',     pct: 17, count: 47, color: '#a855f7', trending: true,
        prompts: ['Youth unemployment trends in Morocco', 'Impact of informal sector on Moroccan labor market', 'Skills gap analysis for Morocco industrial zones'] },
      { id: 'oth', name: 'General Queries',            pct: 14, count: 40, color: '#5d6b7e',
        prompts: ['Cross-cutting country diagnostic questions', 'Ad-hoc operational queries', 'General knowledge base searches'] },
    ],
    [
      { id: 'cli', name: 'Climate, Energy & Infrastructure', pct: 16, count: 45, color: '#22d3ee',
        prompts: ['Climate finance flows in West Africa', 'Renewable energy transition in Morocco', 'Infrastructure resilience for coastal Ghana'] },
      { id: 'les', name: 'Project Lessons & Evidence',       pct: 13, count: 37, color: '#14b8a6',
        prompts: ['Lessons from fiscal reform programs in Ghana', 'What worked in labor market interventions in MNA?', 'Implementation lessons from infrastructure projects'] },
      { id: 'hf',  name: 'Housing & Urban Finance',          pct: 12, count: 34, color: '#ec4899',
        prompts: ['Housing finance gaps in Sub-Saharan Africa', 'Mortgage market conditions in Morocco', 'Affordable housing policy in urban Ghana'] },
    ],
  ];

  private readonly knowledgeByRepeat: TreemapTopic[][] = [
    [
      { id: 'eg',  name: 'Macroeconomic Research', pct: 32, count: 56, color: '#2c8aff',
        prompts: ['Recurring GDP tracking queries for Ghana', 'Monthly poverty indicator updates', 'Follow-up on macroeconomic stabilisation program'] },
      { id: 'oth', name: 'General Queries',         pct: 18, count: 32, color: '#5d6b7e',
        prompts: ['Repeated cross-cutting operational queries', 'Recurring country diagnostic requests', 'Frequently asked general knowledge questions'] },
      { id: 'ml',  name: 'Labor & Social Policy',  pct: 14, count: 24, color: '#a855f7',
        prompts: ['Monthly youth unemployment monitoring', 'Recurring informal sector analysis', 'Follow-up on Morocco skills development program'] },
    ],
    [
      { id: 'cli', name: 'Climate, Energy & Infrastructure', pct: 16, count: 28, color: '#22d3ee',
        prompts: ['Recurring climate finance flow queries', 'Monthly energy transition status updates', 'Follow-up on infrastructure resilience assessments'] },
      { id: 'les', name: 'Project Lessons & Evidence',       pct: 11, count: 19, color: '#14b8a6',
        prompts: ['Repeated lessons queries for reform programs', 'Recurring intervention effectiveness searches', 'Follow-up on project completion findings'] },
      { id: 'hf',  name: 'Housing & Urban Finance',          pct:  9, count: 16, color: '#ec4899',
        prompts: ['Monthly housing finance market updates', 'Recurring mortgage market indicator queries', 'Follow-up on affordable housing program results'] },
    ],
  ];

  private readonly peopleByVolume: TreemapTopic[][] = [
    [
      { id: 'exp',  name: 'Expert & People Discovery', pct: 45, count: 37, color: '#a855f7',
        prompts: ['Find climate specialists in EAP', 'Who leads our education work in SSA?', 'Staff experienced in digital government reforms'] },
    ],
    [
      { id: 'peer', name: 'Peer Review Requests',       pct: 30, count: 24, color: '#c4b5fd',
        prompts: ['Request peer review for infrastructure assessment', 'Who can review this poverty analysis?', 'Find peer reviewers for financial sector report'] },
      { id: 'cel',  name: 'Country Expert Locator',     pct: 25, count: 20, color: '#22d3ee',
        prompts: ['Experts currently working in Kenya', 'Who has experience in Morocco education sector?', 'Find country specialists for Ghana portfolio review'] },
    ],
  ];

  private readonly peopleByRepeat: TreemapTopic[][] = [
    [
      { id: 'exp',  name: 'Expert & People Discovery', pct: 50, count: 22, color: '#a855f7',
        prompts: ['Recurring sector specialist lookups', 'Repeated education expert directory queries', 'Regular governance specialist searches'] },
    ],
    [
      { id: 'cel',  name: 'Country Expert Locator',     pct: 28, count: 12, color: '#22d3ee',
        prompts: ['Repeated country expert lookups for Kenya', 'Regular Morocco portfolio specialist queries', 'Recurring Ghana country team searches'] },
      { id: 'peer', name: 'Peer Review Requests',       pct: 22, count: 10, color: '#c4b5fd',
        prompts: ['Recurring peer reviewer requests for sector reports', 'Repeated quality review panel lookups', 'Regular technical review team queries'] },
    ],
  ];

  private readonly tasksByVolume: TreemapTopic[][] = [
    [
      { id: 'tor', name: 'TOR Generation',                  pct: 48, count: 47, color: '#38bdf8',
        prompts: ['Draft a TOR for a public expenditure review', 'Generate scope of work for private sector assessment', 'TOR template for an education sector loan'] },
    ],
    [
      { id: 'syn', name: 'Synthesis & Research Generation', pct: 30, count: 29, color: '#22d3ee',
        prompts: ['Synthesize recent research on fiscal decentralization', 'Generate briefing on climate adaptation finance', 'Research summary on urban resilience interventions'] },
      { id: 'doc', name: 'Document & Portfolio Analysis',   pct: 22, count: 21, color: '#ec4899',
        prompts: ['Analyze the Ghana portfolio for thematic trends', 'Summarize ICR findings from last 5 operations', 'Extract lessons from project completion reports'] },
    ],
  ];

  private readonly tasksByRepeat: TreemapTopic[][] = [
    [
      { id: 'tor', name: 'TOR Generation',                  pct: 52, count: 28, color: '#38bdf8',
        prompts: ['Recurring TOR drafts for country operations', 'Repeated scope of work templates', 'Regular diagnostic TOR generation requests'] },
    ],
    [
      { id: 'doc', name: 'Document & Portfolio Analysis',   pct: 26, count: 14, color: '#ec4899',
        prompts: ['Monthly portfolio performance analysis', 'Recurring completion report reviews', 'Regular thematic portfolio summaries'] },
      { id: 'syn', name: 'Synthesis & Research Generation', pct: 22, count: 12, color: '#22d3ee',
        prompts: ['Recurring briefing note generation', 'Repeated research synthesis on governance', 'Regular evidence summaries for country teams'] },
    ],
  ];

  readonly activeTreemap = computed(() => {
    const tab = this.activeTab();
    const mode = this.tmMode();
    if (tab === 'knowledge') return mode === 'volume' ? this.knowledgeByVolume : this.knowledgeByRepeat;
    if (tab === 'people')    return mode === 'volume' ? this.peopleByVolume    : this.peopleByRepeat;
    return                          mode === 'volume' ? this.tasksByVolume     : this.tasksByRepeat;
  });

  readonly rowFlex = (row: TreemapTopic[]) => row.reduce((s, t) => s + t.pct, 0);

  // ---- Knowledge Friction Signals (right column) ----
  // Each row tells a different friction story so the list is useful at a glance.
  // Captions are two short words each — they wrap to 2 lines so values align.
  readonly frictionSignals: FrictionSignal[] = [
    {
      domain: 'knowledge', topic: 'Macroeconomic Research', topicId: 'eg',
      kind: 'dislike',
      metricValue: 75, metricUnit: '%', metricCaption: 'answers disliked',
      volume: 126, volumeLabel: 'prompts',
      direction: 'up', changePct: 20,
    },
    {
      domain: 'people', topic: 'Expert & People Discovery', topicId: 'exp',
      kind: 'clarify',
      metricValue: 32, metricUnit: '%', metricCaption: 'intent clarification rate',
      volume: 64, volumeLabel: 'searches',
      direction: 'down', changePct: 22,
    },
    {
      domain: 'task', topic: 'Document & TOR Generation', topicId: 'tor',
      kind: 'low-download',
      metricValue: 12, metricUnit: '%', metricCaption: 'downloads',
      volume: 142, volumeLabel: 'generations',
      direction: 'down', changePct: 6,
    },
  ];

  /** Maps friction-signal domain to KPT tab id used by the analysis page. */
  kptForDomain(d: FrictionDomain): 'knowledge' | 'people' | 'tasks' {
    if (d === 'knowledge') return 'knowledge';
    if (d === 'people')    return 'people';
    return 'tasks';
  }

  domainLabel(d: FrictionDomain): string {
    if (d === 'knowledge') return 'Knowledge';
    if (d === 'people') return 'People';
    return 'Task';
  }

  /** Tabler icon name used as the kind glyph on the left of each signal. */
  kindIcon(k: FrictionKind): string {
    if (k === 'dislike')      return 'thumb-down';
    if (k === 'clarify')      return 'message-report';
    if (k === 'low-expert')   return 'users';
    if (k === 'outdated')     return 'alert-triangle';
    return 'file-download';
  }
}
