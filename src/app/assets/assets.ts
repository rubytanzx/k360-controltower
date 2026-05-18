import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';

type Tab = 'agents' | 'collections';
type Usage = 'high' | 'medium' | 'low';
type ChipSeverity = 'warning' | 'danger';

interface Node {
  id: string;
  label: string;
  usage: Usage;
  level: 'root' | 'branch' | 'leaf';
  x: number;
  y: number;
  warning?: { text: string; severity: ChipSeverity };
}

interface Link {
  from: string;
  to: string;
}

interface CanvasData {
  nodes: Node[];
  links: Link[];
  agentsCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

type CollectionStatus = 'integrated' | 'in-progress' | 'pending';
type DemandRank = 'very-high' | 'high' | 'medium' | 'low' | 'rising';
type Freshness = 'current' | 'aging' | 'stale' | 'unsynced';
type RiskTier = 'high' | 'medium' | 'low';

interface CollectionRecord {
  name: string;
  icon: string;
  type: string;
  status: CollectionStatus;
  coverage: number;
  lastSynced: string;
  freshness: Freshness;
  demand: DemandRank;
}

interface TopPromptType {
  text: string;
  freq: number;
  score: number;
}

interface NegativeFeedbackTag {
  label: string;
  freq: number;
}

interface GovernanceAction {
  label: string;
  icon: string;
  intent?: 'primary' | 'default';
}

interface CollectionDetails {
  id: string;
  name: string;
  icon: string;
  risk: RiskTier;
  sources: string[];        // e.g. ['SharePoint', 'PDF']
  totalFiles: number;
  retrievalPct: number;
  retrievalCount: number;
  citationCoverage: number;
  promptDependency: number;
  topPromptTypes: TopPromptType[];
  topNegative: NegativeFeedbackTag[];
  governance: GovernanceAction[];
}

interface CollectionKpi {
  title: string;
  value: string;
  sub: string;
  icon: string;
  tone: 'purple' | 'cyan' | 'amber' | 'red' | 'green';
  pct: number;
}

const CARD_W = 200;
const CARD_H = 110;
const VIEW_W = 1860;
const VIEW_H = 400;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const DEFAULT_ZOOM = 0.6;
const DEFAULT_PAN_X = 20;
const DEFAULT_PAN_Y = 80;

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

@Component({
  selector: 'app-assets',
  imports: [TablerIconComponent, RouterLink],
  templateUrl: './assets.html',
  styleUrl: './assets.css',
})
export class Assets {
  readonly tab = signal<Tab>('agents');

  constructor() {
    const route = inject(ActivatedRoute);
    const initial = route.snapshot.queryParamMap.get('tab');
    if (initial === 'collections' || initial === 'agents') {
      this.tab.set(initial);
    }
  }

  readonly cardW = CARD_W;
  readonly cardH = CARD_H;
  readonly viewW = VIEW_W;
  readonly viewH = VIEW_H;

  // ----- Agents canvas -----
  // Orchestrator on top, 8 children on a single row below
  readonly agentsData: CanvasData = {
    nodes: [
      { id: 'orch', label: 'MultiAgent Synthesis', usage: 'high', level: 'root',
        x: 830, y: 30 },

      { id: 'tor',  label: 'TOR Genie',                                    usage: 'high',   level: 'leaf', x: 25,   y: 240 },
      { id: 'sher', label: 'Sherlock Expertise Detective',                 usage: 'high',   level: 'leaf', x: 255,  y: 240 },
      { id: 'less', label: 'Lessons Explorer',                             usage: 'medium', level: 'leaf', x: 485,  y: 240,
        warning: { text: 'Low Source Diversity', severity: 'warning' } },
      { id: 'grum', label: 'Grumpy Reviewer',                              usage: 'high',   level: 'leaf', x: 715,  y: 240 },
      { id: 'lit',  label: 'Literature Review and Policy Paper Generator', usage: 'medium', level: 'leaf', x: 945,  y: 240,
        warning: { text: 'Conflicting Outputs', severity: 'warning' } },
      { id: 'isr',  label: 'ISR Issues Explorer',                          usage: 'low',    level: 'leaf', x: 1175, y: 240,
        warning: { text: 'Possible Stale Data', severity: 'danger' } },
      { id: 'sspa', label: 'Self-Service Portfolio Analysis (SSPA)',       usage: 'high',   level: 'leaf', x: 1405, y: 240 },
      { id: 'wbg',  label: 'WBG Translate Tool',                           usage: 'high',   level: 'leaf', x: 1635, y: 240 },
    ],
    links: [
      { from: 'orch', to: 'tor' },
      { from: 'orch', to: 'sher' },
      { from: 'orch', to: 'less' },
      { from: 'orch', to: 'grum' },
      { from: 'orch', to: 'lit' },
      { from: 'orch', to: 'isr' },
      { from: 'orch', to: 'sspa' },
      { from: 'orch', to: 'wbg' },
    ],
    agentsCount: 9,
    highCount: 6,
    mediumCount: 2,
    lowCount: 1,
  };

  // ----- Ingested Collections canvas -----
  readonly collectionsData: CanvasData = {
    nodes: [
      { id: 'idx', label: 'Source Index', usage: 'high', level: 'root', x: 510, y: 20 },

      { id: 'docs',   label: 'Documents',       usage: 'high',   level: 'branch', x: 20,  y: 180 },
      { id: 'wikis',  label: 'Wikis',           usage: 'high',   level: 'branch', x: 235, y: 180 },
      { id: 'struct', label: 'Structured Data', usage: 'medium', level: 'branch', x: 450, y: 180,
        warning: { text: 'Schema Drift', severity: 'warning' } },
      { id: 'web',    label: 'Web Sources',     usage: 'high',   level: 'branch', x: 665, y: 180 },
      { id: 'streams', label: 'Event Streams',  usage: 'low',    level: 'branch', x: 880, y: 180,
        warning: { text: 'Possible Stale Data', severity: 'danger' } },

      { id: 'sp',   label: 'SharePoint Library',     usage: 'high',   level: 'leaf', x: 20,  y: 350 },
      { id: 'conf', label: 'Confluence Wiki',        usage: 'high',   level: 'leaf', x: 235, y: 350 },
      { id: 'sql',  label: 'SQL Data Warehouse',     usage: 'medium', level: 'leaf', x: 450, y: 350,
        warning: { text: 'Sync Lag 14d', severity: 'warning' } },
      { id: 'crawl', label: 'External Web Crawler',  usage: 'high',   level: 'leaf', x: 665, y: 350 },
      { id: 'kafka', label: 'Kafka Event Stream',    usage: 'low',    level: 'leaf', x: 880, y: 350,
        warning: { text: 'Connection Errors', severity: 'danger' } },
    ],
    links: [
      { from: 'idx', to: 'docs' },
      { from: 'idx', to: 'wikis' },
      { from: 'idx', to: 'struct' },
      { from: 'idx', to: 'web' },
      { from: 'idx', to: 'streams' },
      { from: 'docs',    to: 'sp' },
      { from: 'wikis',   to: 'conf' },
      { from: 'struct',  to: 'sql' },
      { from: 'web',     to: 'crawl' },
      { from: 'streams', to: 'kafka' },
    ],
    agentsCount: 11,
    highCount: 8,
    mediumCount: 2,
    lowCount: 1,
  };

  readonly current = computed(() =>
    this.tab() === 'agents' ? this.agentsData : this.collectionsData,
  );

  readonly summaryLabel = computed(() =>
    this.tab() === 'agents' ? 'Agents' : 'Sources',
  );

  readonly lines = computed(() => {
    const data = this.current();
    const byId = new Map(data.nodes.map((n) => [n.id, n] as const));
    return data.links.flatMap((l) => {
      const from = byId.get(l.from);
      const to = byId.get(l.to);
      if (!from || !to) return [];
      const x1 = from.x + CARD_W / 2;
      const y1 = from.y + CARD_H;
      const x2 = to.x + CARD_W / 2;
      const y2 = to.y;
      return [{ d: curve(x1, y1, x2, y2), key: `${l.from}-${l.to}` }];
    });
  });

  // ----- pan / zoom -----
  readonly panX = signal(DEFAULT_PAN_X);
  readonly panY = signal(DEFAULT_PAN_Y);
  readonly zoom = signal(DEFAULT_ZOOM);
  readonly dragging = signal(false);
  private dragStart = { x: 0, y: 0, panX: 0, panY: 0 };

  readonly transform = computed(
    () => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`,
  );

  readonly bgPosition = computed(() => `${this.panX()}px ${this.panY()}px`);

  readonly bgSize = computed(() => {
    const s = 16 * this.zoom();
    return `${s}px ${s}px`;
  });

  onCanvasMouseDown(e: MouseEvent) {
    // Only respond to primary button
    if (e.button !== 0) return;
    this.dragging.set(true);
    this.dragStart = {
      x: e.clientX,
      y: e.clientY,
      panX: this.panX(),
      panY: this.panY(),
    };
    e.preventDefault();
  }

  onCanvasMouseMove(e: MouseEvent) {
    if (!this.dragging()) return;
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;
    this.panX.set(this.dragStart.panX + dx);
    this.panY.set(this.dragStart.panY + dy);
  }

  onCanvasMouseUp() {
    this.dragging.set(false);
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    this.zoom.update((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)));
  }

  zoomIn() {
    this.zoom.update((z) => Math.min(MAX_ZOOM, z * 1.15));
  }

  zoomOut() {
    this.zoom.update((z) => Math.max(MIN_ZOOM, z / 1.15));
  }

  resetView() {
    this.panX.set(DEFAULT_PAN_X);
    this.panY.set(DEFAULT_PAN_Y);
    this.zoom.set(DEFAULT_ZOOM);
  }

  setTab(t: Tab) {
    this.tab.set(t);
    this.resetView();
  }

  // ----- Knowledge Collections content -----
  readonly collectionKpis: CollectionKpi[] = [
    {
      title: 'Total Sources Integrated',
      value: '32',
      sub: 'of ~40 priority collections',
      icon: 'stack-2',
      tone: 'purple',
      pct: 80,
    },
    {
      title: 'Overall Coverage',
      value: '80%',
      sub: 'interim target met',
      icon: 'target',
      tone: 'green',
      pct: 80,
    },
    {
      title: 'Added This Month',
      value: '+2',
      sub: 'new collections',
      icon: 'plus',
      tone: 'cyan',
      pct: 60,
    },
    {
      title: 'Freshness Alert',
      value: '3',
      sub: 'not synced in >30 days',
      icon: 'alert-triangle',
      tone: 'red',
      pct: 20,
    },
  ];

  readonly collectionsList: CollectionRecord[] = [
    { name: 'WBG Library',           icon: 'library',    type: 'Library',    status: 'integrated',  coverage: 100, lastSynced: '2d ago',  freshness: 'current', demand: 'high' },
    { name: 'Intranet',              icon: 'building',   type: 'Intranet',   status: 'integrated',  coverage: 100, lastSynced: '1d ago',  freshness: 'current', demand: 'high' },
    { name: 'Data360',               icon: 'chart-bar',  type: 'Data',       status: 'integrated',  coverage: 100, lastSynced: '3d ago',  freshness: 'current', demand: 'medium' },
    { name: 'Sector Flagships',      icon: 'flag',       type: 'Sector',     status: 'in-progress', coverage: 80,  lastSynced: '5d ago',  freshness: 'current', demand: 'high' },
    { name: 'Country Profiles',      icon: 'map',        type: 'Country',    status: 'in-progress', coverage: 65,  lastSynced: '8d ago',  freshness: 'aging',   demand: 'high' },
    { name: 'TOR Templates',         icon: 'file-text',  type: 'TOR',        status: 'in-progress', coverage: 40,  lastSynced: '12d ago', freshness: 'aging',   demand: 'very-high' },
    { name: 'Evaluation Reports',    icon: 'report',     type: 'Evaluation', status: 'pending',     coverage: 25,  lastSynced: '45d ago', freshness: 'stale',   demand: 'rising' },
    { name: 'IFC Project Docs',      icon: 'briefcase',  type: 'Library',    status: 'pending',     coverage: 10,  lastSynced: '—',       freshness: 'unsynced', demand: 'medium' },
    { name: 'Procurement Library',   icon: 'package',    type: 'Library',    status: 'pending',     coverage: 0,   lastSynced: '—',       freshness: 'unsynced', demand: 'low' },
    { name: 'Spotlight Collections', icon: 'star',       type: 'Spotlight',  status: 'integrated',  coverage: 100, lastSynced: '1d ago',  freshness: 'current', demand: 'medium' },
  ];

  readonly collectionsTotal = 42;

  readonly statusOptions = [
    { id: 'all',         label: 'All Statuses' },
    { id: 'integrated',  label: 'Integrated' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'pending',     label: 'Pending' },
  ];

  readonly statusFilter = signal<string>('all');
  readonly activeChip = signal<string | null>(null);
  readonly statusOpen = signal(false);

  readonly statusFilterLabel = computed(
    () => this.statusOptions.find((o) => o.id === this.statusFilter())?.label ?? 'All Statuses',
  );

  readonly filteredCollections = computed(() => {
    const status = this.statusFilter();
    const chip = this.activeChip();
    return this.collectionsList.filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (chip === 'outdated' && c.freshness !== 'stale') return false;
      if (chip === 'high-demand' && !['very-high', 'high'].includes(c.demand)) return false;
      if (chip === 'newly-ingested' && c.status !== 'integrated') return false;
      return true;
    });
  });

  toggleStatusOpen() { this.statusOpen.update((v) => !v); }
  closeStatusFilter() { this.statusOpen.set(false); }
  pickStatus(id: string) { this.statusFilter.set(id); this.statusOpen.set(false); }
  toggleChip(id: string) {
    this.activeChip.update((c) => (c === id ? null : id));
  }

  // labels for demand pill
  demandLabel(d: DemandRank): string {
    switch (d) {
      case 'very-high': return 'Very High';
      case 'high':      return 'High';
      case 'medium':    return 'Medium';
      case 'low':       return 'Low';
      case 'rising':    return 'Rising';
    }
  }

  statusLabel(s: CollectionStatus): string {
    switch (s) {
      case 'integrated':  return 'Integrated';
      case 'in-progress': return 'In Progress';
      case 'pending':     return 'Pending';
    }
  }

  // ----- Collection Details drawer -----
  private readonly defaultGovernance: GovernanceAction[] = [
    { label: 'Re-index Collection',     icon: 'refresh',    intent: 'primary' },
    { label: 'Review Metadata Tags',    icon: 'tag' },
    { label: 'Adjust Retrieval Weighting', icon: 'chart-bar' },
    { label: 'View Audit Log',          icon: 'report' },
  ];

  private detailsFor(c: CollectionRecord): CollectionDetails {
    // Derive a deterministic "ID" suffix from the name for the mock view
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8) || 'unknown';
    const risk: RiskTier =
      c.freshness === 'stale' || c.coverage < 30 ? 'high'
      : c.freshness === 'aging' || c.coverage < 70 ? 'medium'
      : 'low';

    return {
      id: `col_${slug}`,
      name: c.name,
      icon: c.icon,
      risk,
      sources: ['SharePoint', 'PDF'],
      totalFiles: 1284,
      retrievalPct: 32,
      retrievalCount: 412,
      citationCoverage: 41,
      promptDependency: 32,
      topPromptTypes: [
        { text: 'Do you have a copy of the latest staff instructions',           freq: 124, score: 0.92 },
        { text: 'Link to the latest staff instruction for technical assitance',  freq: 98,  score: 0.88 },
        { text: 'Can you provide the latest guidelines and policies?',           freq: 45,  score: 0.76 },
      ],
      topNegative: [
        { label: 'Outdated Content',      freq: 4 },
        { label: 'Incomplete Information', freq: 3 },
        { label: 'Incorrect References',   freq: 2 },
        { label: 'Too Generic',            freq: 2 },
      ],
      governance: this.defaultGovernance,
    };
  }

  readonly collectionDrawerOpen = signal(false);
  readonly collectionDetails = signal<CollectionDetails | null>(null);
  readonly collectionDrawerExpanded = signal(false);
  readonly collectionDrawerWidth = signal(720);
  readonly isCollectionResizing = signal(false);

  private resizeStartX = 0;
  private resizeStartWidth = 0;

  openCollectionDrawer(c: CollectionRecord) {
    this.collectionDetails.set(this.detailsFor(c));
    this.collectionDrawerOpen.set(true);
    this.collectionDrawerExpanded.set(false);
  }

  closeCollectionDrawer() {
    this.collectionDrawerOpen.set(false);
    this.collectionDrawerExpanded.set(false);
  }

  toggleCollectionDrawerExpand() {
    this.collectionDrawerExpanded.update((v) => !v);
  }

  onCollectionResizeStart(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.collectionDrawerExpanded.set(false);
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = this.collectionDrawerWidth();
    this.isCollectionResizing.set(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this.onCollectionResizeMove);
    document.addEventListener('mouseup', this.onCollectionResizeEnd);
  }

  private readonly onCollectionResizeMove = (e: MouseEvent) => {
    if (!this.isCollectionResizing()) return;
    const delta = this.resizeStartX - e.clientX;
    const max = Math.max(480, window.innerWidth - 80);
    const next = Math.max(420, Math.min(max, this.resizeStartWidth + delta));
    this.collectionDrawerWidth.set(next);
  };

  private readonly onCollectionResizeEnd = () => {
    this.isCollectionResizing.set(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', this.onCollectionResizeMove);
    document.removeEventListener('mouseup', this.onCollectionResizeEnd);
  };

  riskLabel(r: RiskTier): string {
    switch (r) {
      case 'high':   return 'High Risk';
      case 'medium': return 'Medium Risk';
      case 'low':    return 'Low Risk';
    }
  }
}
