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

  // ---- Toggle: By Volume / By Repeat Rate ----
  readonly tmMode = signal<TmMode>('volume');
  setTmMode(m: TmMode) { this.tmMode.set(m); }

  // ---- Treemap data (one matrix per tab) ----
  private readonly knowledgeByVolume: TreemapTopic[][] = [
    [
      { id: 'eg',  name: 'Ghana Economic Growth',     pct: 28, count: 79, color: '#2c8aff' },
      { id: 'ml',  name: 'Morocco Labor Markets',     pct: 17, count: 47, color: '#a855f7', trending: true },
      { id: 'oth', name: 'Other',                     pct: 14, count: 40, color: '#5d6b7e' },
    ],
    [
      { id: 'exp', name: 'Expertise / People Search', pct: 13, count: 37, color: '#f59e0b' },
      { id: 'cli', name: 'Climate & Infrastructure',  pct: 11, count: 31, color: '#22d3ee' },
      { id: 'les', name: 'Lessons Explorer',          pct: 9,  count: 26, color: '#14b8a6' },
      { id: 'hf',  name: 'Housing & Finance',         pct: 8,  count: 22, color: '#ec4899' },
    ],
  ];

  private readonly knowledgeByRepeat: TreemapTopic[][] = [
    [
      { id: 'eg',  name: 'Ghana Economic Growth',     pct: 32, count: 56, color: '#2c8aff' },
      { id: 'oth', name: 'Other',                     pct: 18, count: 32, color: '#5d6b7e' },
      { id: 'ml',  name: 'Morocco Labor Markets',     pct: 14, count: 24, color: '#a855f7' },
    ],
    [
      { id: 'cli', name: 'Climate & Infrastructure',  pct: 12, count: 21, color: '#22d3ee' },
      { id: 'exp', name: 'Expertise / People Search', pct: 10, count: 18, color: '#f59e0b' },
      { id: 'les', name: 'Lessons Explorer',          pct: 8,  count: 14, color: '#14b8a6' },
      { id: 'hf',  name: 'Housing & Finance',         pct: 6,  count: 11, color: '#ec4899' },
    ],
  ];

  private readonly peopleByVolume: TreemapTopic[][] = [
    [
      { id: 'exp',  name: 'Expertise Search by Sector', pct: 45, count: 37, color: '#a855f7' },
    ],
    [
      { id: 'peer', name: 'Peer Review Requests',       pct: 30, count: 24, color: '#c4b5fd' },
      { id: 'cel',  name: 'Country Expert Locator',     pct: 25, count: 20, color: '#22d3ee' },
    ],
  ];

  private readonly peopleByRepeat: TreemapTopic[][] = [
    [
      { id: 'exp',  name: 'Expertise Search by Sector', pct: 50, count: 22, color: '#a855f7' },
    ],
    [
      { id: 'cel',  name: 'Country Expert Locator',     pct: 28, count: 12, color: '#22d3ee' },
      { id: 'peer', name: 'Peer Review Requests',       pct: 22, count: 10, color: '#c4b5fd' },
    ],
  ];

  private readonly tasksByVolume: TreemapTopic[][] = [
    [
      { id: 'tor', name: 'TOR Generation',                  pct: 48, count: 47, color: '#38bdf8' },
    ],
    [
      { id: 'syn', name: 'Synthesis & Research Generation', pct: 30, count: 29, color: '#22d3ee' },
      { id: 'doc', name: 'Document & Portfolio Analysis',   pct: 22, count: 21, color: '#ec4899' },
    ],
  ];

  private readonly tasksByRepeat: TreemapTopic[][] = [
    [
      { id: 'tor', name: 'TOR Generation',                  pct: 52, count: 28, color: '#38bdf8' },
    ],
    [
      { id: 'doc', name: 'Document & Portfolio Analysis',   pct: 26, count: 14, color: '#ec4899' },
      { id: 'syn', name: 'Synthesis & Research Generation', pct: 22, count: 12, color: '#22d3ee' },
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
      domain: 'knowledge', topic: 'Ghana Economic Growth', topicId: 'eg',
      kind: 'dislike',
      metricValue: 75, metricUnit: '%', metricCaption: 'answers disliked',
      volume: 126, volumeLabel: 'prompts',
      direction: 'up', changePct: 20,
    },
    {
      domain: 'people', topic: 'Energy Sector Experts', topicId: 'exp',
      kind: 'clarify',
      metricValue: 32, metricUnit: '%', metricCaption: 'intent clarification rate',
      volume: 64, volumeLabel: 'searches',
      direction: 'down', changePct: 22,
    },
    {
      domain: 'task', topic: 'TOR Generation — Climate', topicId: 'tor',
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
