import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TablerIconComponent } from '@tabler/icons-angular';
import { RouterLink } from '@angular/router';
import { HierFilter } from '../shared/hier-filter/hier-filter';
import { REGION_GROUPS, VPU_GROUPS } from '../shared/hier-filter/hier-filter-catalog';
import { DateRangeFilter } from '../shared/date-range-filter/date-range-filter';
import { toSlug } from '../shared/slug';

type SegmentId = 'focused' | 'power' | 'onetime' | 'low';
type Period = '30d' | '60d' | '90d';
type KptDomain = 'knowledge' | 'people' | 'tasks';
type KptTab = KptDomain;
type Workspace = 'wb' | 'ifc';
type MapMode = 'region' | 'country';

interface SegPromptCategory { label: string; pct: number; prompts: number; }
interface SegVpuRow         { code: string; pct: number; growth: number; }
interface SegUsage          { name: string; usage: number; }

interface KpiMetric { value: string; label?: string; delta?: string; }
interface OverviewKpi { title: string; metrics: KpiMetric[]; sub?: string; }

interface Vpu { code: string; name: string; color: string; }
interface VpuStats extends Vpu {
  conversations: number;
  promptsPerSession: number;
  activeUsers: number;
  segment: SegmentId;
  topPromptCategory: string;
  topCollection: string;
}
interface SegmentRollup {
  segment: SegmentId;
  label: string;
  vpus: VpuStats[];
  total: number;
}

interface Segment {
  id: SegmentId;
  name: string;
  pct: number;
  users: string;
}

interface FunnelStage {
  label: string;
  desc: string;
  users: number;
  pct: number;
  color: string;
}

interface KptSegment {
  domain: KptDomain;
  color: string;
  label: string;
  pct: number;
  sub: string;
  bottom: string;
}

interface VpuRow {
  name: string;
  visits: number;
}

interface CountryRow {
  name: string;
  queries: number;
}

interface RoleRow {
  role: string;
  time: number;
  visitors: number;
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
  imports: [TablerIconComponent, HierFilter, DateRangeFilter, RouterLink],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users {
  // ---- Workspace + filter bar state ----
  readonly workspace = signal<Workspace>('wb');
  setWorkspace(w: Workspace) { this.workspace.set(w); }

  // ---- Hierarchical filter catalogs (shared across pages) ----
  readonly regionGroups = REGION_GROUPS;
  readonly vpuGroups    = VPU_GROUPS;

  // ---- KPI cards — values from K360 Master Data Extract (Power BI Jan 1 – May 19, 2026) ----
  // 3,095 unique visitors / 2,923 repeat users → 172 new; 16.73% adoption (target 50%);
  // 30,020 page views ÷ 3,095 visitors ≈ 9.7 views/user (overall) but K360 page views avg
  // per visitor = 3 in source; exploration depth = views per session.
  readonly userKpis: OverviewKpi[] = [
    { title: 'Unique Active Users',         metrics: [{ value: '3,095', delta: '+12%' }], sub: 'of ~18,500 WBG staff' },
    { title: 'Staff Adoption Rate',         metrics: [{ value: '17%',   delta: '+2.4pp' }], sub: 'target: 50% by Dec 2026' },
    { title: 'New vs Returning Users',      metrics: [
      { value: '172',   label: 'new' },
      { value: '2,923', label: 'returning' },
    ] },
    { title: 'Average K360 Views per User', metrics: [{ value: '3',     delta: '+0.4' }] },
    { title: 'Exploration Depth',           metrics: [{ value: '3.2',   delta: '+0.3' }], sub: 'page views per session' },
  ];

  // ---- Top Engaged / Highest Growth VPU cards (ranked top 3 by visits) ----
  // Real ranking from Power BI Adoption-by-VPU table.
  readonly topEngagedVpus: { code: string; name: string; users: number }[] = [
    { code: 'AFWW1', name: 'Western & Central Africa — Country Unit', users: 100 },
    { code: 'AFCE2', name: 'Eastern & Southern Africa — Country Unit 2', users: 92 },
    { code: 'AFCE1', name: 'Eastern & Southern Africa — Country Unit 1', users: 86 },
  ];

  // Growth values are illustrative; the underlying VPU codes are real Power BI codes.
  readonly highestGrowthVpus: { code: string; name: string; growthPct: number }[] = [
    { code: 'SACFP', name: 'South Asia — Country Fiscal & Policy', growthPct: 32 },
    { code: 'MNCPX', name: 'MENA — Country Practice Unit',         growthPct: 22 },
    { code: 'AECE3', name: 'Eastern & Southern Africa — Country Unit 3', growthPct: 18 },
  ];

  // ---- VPU-driven scatter + segmentation ----
  // Recomputed when the period (30d/60d/90d) changes so dots move with the
  // selected window. activePeriod is declared lower in the file but signals
  // are safe to reference from a computed that runs lazily.
  readonly vpuScatterData = computed<VpuStats[]>(() => buildVpuStats(this.activePeriod()));

  readonly selectedVpu = signal<string | null>(null);
  readonly hoveredVpu  = signal<string | null>(null);

  /** Code of the VPU currently focused via hover OR click — used to drive
   *  the tooltip, the dot highlight, and the bar-section highlight. */
  readonly focusedVpu = computed<string | null>(
    () => this.hoveredVpu() ?? this.selectedVpu(),
  );

  readonly focusedVpuStats = computed<VpuStats | null>(() => {
    const code = this.focusedVpu();
    if (!code) return null;
    return this.vpuScatterData().find(v => v.code === code) ?? null;
  });

  /** Selected VPU with its plotted screen position — drives the popup
   *  card that floats above the clicked dot. Null when no dot is selected. */
  readonly selectedVpuDot = computed(() => {
    const code = this.selectedVpu();
    if (!code) return null;
    return this.vpuDots().find(d => d.code === code) ?? null;
  });

  /** Lightweight tooltip data (name only) for hover. */
  readonly hoveredVpuTooltip = computed<VpuStats | null>(() => {
    const code = this.hoveredVpu();
    if (!code) return null;
    return this.vpuScatterData().find(v => v.code === code) ?? null;
  });

  selectVpu(code: string) {
    this.selectedVpu.update(cur => (cur === code ? null : code));
  }

  /** Generate a URL slug for collection/agent detail links. */
  slugFor(name: string): string { return toSlug(name); }

  segmentPct(part: number, total: number): number {
    return total === 0 ? 0 : Math.round((part / total) * 100);
  }

  // ============================================================
  // Segment drawer — opens when a User Segmentation row label is
  // clicked. Reuses the world map + treemap patterns from the
  // collection detail drawer.
  // ============================================================
  private readonly sanitizer = inject(DomSanitizer);

  readonly segDrawerSegment = signal<SegmentId | null>(null);
  readonly segDrawerOpen = computed(() => this.segDrawerSegment() !== null);
  readonly segDrawerTab = signal<KptTab>('knowledge');
  readonly segDrawerMapMode = signal<MapMode>('region');
  readonly segDrawerMapSelection = signal<{ name: string; users: number } | null>(null);

  readonly segDrawerData = computed(() => {
    const seg = this.segDrawerSegment();
    return seg ? SEGMENT_DRAWER_DATA[seg] : null;
  });

  readonly activeSegPromptCategories = computed(() => {
    const data = this.segDrawerData();
    return data ? data.promptCategories[this.segDrawerTab()] : [];
  });

  openSegDrawer(seg: SegmentId) {
    this.segDrawerSegment.set(seg);
    this.segDrawerTab.set('knowledge');
    this.segDrawerMapSelection.set(null);
  }
  closeSegDrawer() {
    this.segDrawerSegment.set(null);
    this.segDrawerMapSelection.set(null);
  }
  setSegDrawerMapMode(m: MapMode) {
    this.segDrawerMapMode.set(m);
    this.segDrawerMapSelection.set(null);
  }

  // World map inline SVG (same source as the dashboard / collection detail).
  readonly segMapSvg = signal<SafeHtml | null>(null);
  readonly segMapHost = viewChild<ElementRef<HTMLElement>>('segMapHost');

  // ---- Pan / zoom (same UX as dashboard map) ----
  readonly segMapScale = signal(1);
  readonly segMapTx = signal(0);
  readonly segMapTy = signal(0);
  readonly segMapTransform = computed(
    () => `translate(${this.segMapTx()}px, ${this.segMapTy()}px) scale(${this.segMapScale()})`
  );
  readonly segIsPanning = signal(false);

  private static readonly SEG_MIN_ZOOM = 1;
  private static readonly SEG_MAX_ZOOM = 8;
  private segPanStart: { x: number; y: number; tx: number; ty: number } | null = null;
  private segPanMoved = false;

  constructor() {
    fetch('/world-map-coded.svg')
      .then(r => r.text())
      .then(svg => this.segMapSvg.set(this.sanitizer.bypassSecurityTrustHtml(svg)));

    effect(() => {
      const host = this.segMapHost()?.nativeElement;
      const seg = this.segDrawerSegment();
      this.segMapSvg();
      if (!host || !seg) return;
      setTimeout(() => this.tintSegMap(host, seg), 0);
    });

    // Toggle country labels based on whether each country is wide enough at
    // the current zoom; hide all labels in By Region mode.
    effect(() => {
      const host = this.segMapHost()?.nativeElement;
      const s = this.segMapScale();
      const mode = this.segDrawerMapMode();
      this.segMapSvg();
      this.segDrawerSegment();
      if (!host) return;
      setTimeout(() => this.applySegLabelVisibility(host, s, mode), 0);
    });

    // Reset pan/zoom whenever the drawer opens for a fresh segment.
    effect(() => {
      const open = this.segDrawerOpen();
      if (!open) return;
      this.segMapScale.set(1);
      this.segMapTx.set(0);
      this.segMapTy.set(0);
    });
  }

  private tintSegMap(host: HTMLElement, seg: SegmentId) {
    const svg = host.querySelector<SVGSVGElement>('svg');
    if (!svg) return;
    const intensityMap = SEGMENT_DRAWER_DATA[seg].mapIntensity;
    svg.querySelectorAll<SVGElement>('[id]').forEach(el => {
      const id = el.id?.toLowerCase();
      if (!id || id.startsWith('_') || id === 'world-map') return;
      const intensity = intensityMap[id] ?? 0;
      const region = ISO_TO_REGION_LITE[id] ?? '';
      const targets = el.tagName === 'g'
        ? el.querySelectorAll<SVGPathElement>('path')
        : [el as unknown as SVGPathElement];
      targets.forEach(p => {
        p.dataset['intensity'] = String(intensity);
        if (region) p.dataset['region'] = region;
        p.dataset['country'] = id;
      });
    });
    if (!svg.querySelector('g.labels')) this.buildSegCountryLabels(svg);
  }

  /** Build a one-time <text> label per country inside the SVG. Labels are
   *  hidden/shown depending on how wide the country reads at the current zoom. */
  private buildSegCountryLabels(svg: SVGSVGElement) {
    const ns = 'http://www.w3.org/2000/svg';
    const group = document.createElementNS(ns, 'g');
    group.setAttribute('class', 'labels');
    group.setAttribute('pointer-events', 'none');
    svg.appendChild(group);

    const FONT_SIZE = 7;
    const AVG_CHAR_WIDTH = 0.58;
    svg.querySelectorAll<SVGGraphicsElement>('[id]').forEach(el => {
      const id = el.id?.toLowerCase();
      if (!id || id.startsWith('_') || id === 'world-map') return;
      if (el.tagName !== 'g' && el.tagName !== 'path') return;
      let bbox: DOMRect;
      try { bbox = el.getBBox(); } catch { return; }
      if (!bbox || bbox.width <= 0 || bbox.height <= 0) return;
      const name = COUNTRY_LABEL[id] ?? id.toUpperCase();
      const labelW = name.length * FONT_SIZE * AVG_CHAR_WIDTH;
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', String(bbox.x + bbox.width / 2));
      text.setAttribute('y', String(bbox.y + bbox.height / 2));
      text.setAttribute('class', 'country-label');
      text.dataset['country'] = id;
      text.dataset['bboxw'] = String(bbox.width);
      text.dataset['labelw'] = String(labelW);
      text.textContent = name;
      group.appendChild(text);
    });
  }

  private applySegLabelVisibility(host: HTMLElement, s: number, mode: MapMode) {
    host.querySelectorAll<SVGTextElement>('text.country-label').forEach(t => {
      if (mode === 'region') { t.style.display = 'none'; return; }
      const cw = Number(t.dataset['bboxw'] ?? '0');
      const lw = Number(t.dataset['labelw'] ?? '0');
      t.style.display = cw * s >= lw * 0.9 ? '' : 'none';
    });
  }

  onSegMapClick(event: MouseEvent) {
    // Suppress click after a drag — pan should not select.
    if (this.segPanMoved) { this.segPanMoved = false; return; }
    const seg = this.segDrawerSegment();
    if (!seg) return;
    const target = event.target as Element | null;
    const path = target?.closest?.('path') as SVGPathElement | null;
    if (!path) { this.segDrawerMapSelection.set(null); return; }
    const data = SEGMENT_DRAWER_DATA[seg];
    if (this.segDrawerMapMode() === 'region') {
      const region = path.dataset['region'];
      if (!region) { this.segDrawerMapSelection.set(null); return; }
      const label = REGION_LABEL[region] ?? region.toUpperCase();
      const users = data.regionUsers[region] ?? 0;
      this.segDrawerMapSelection.set({ name: label, users });
    } else {
      const code = path.dataset['country'];
      if (!code) { this.segDrawerMapSelection.set(null); return; }
      const label = COUNTRY_LABEL[code] ?? code.toUpperCase();
      const users = data.countryUsers[code] ?? 0;
      this.segDrawerMapSelection.set({ name: label, users });
    }
  }

  onSegMapWheel(event: WheelEvent) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.segMapScale.update(s =>
      Math.min(Users.SEG_MAX_ZOOM, Math.max(Users.SEG_MIN_ZOOM, s * factor)),
    );
  }

  onSegPanStart(event: MouseEvent) {
    if (event.button !== 0) return;
    this.segPanStart = { x: event.clientX, y: event.clientY, tx: this.segMapTx(), ty: this.segMapTy() };
    this.segPanMoved = false;
    this.segIsPanning.set(true);
  }

  onSegPanMove(event: MouseEvent) {
    if (!this.segPanStart) return;
    const dx = event.clientX - this.segPanStart.x;
    const dy = event.clientY - this.segPanStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.segPanMoved = true;
    this.segMapTx.set(this.segPanStart.tx + dx);
    this.segMapTy.set(this.segPanStart.ty + dy);
  }

  onSegPanEnd() {
    this.segPanStart = null;
    this.segIsPanning.set(false);
  }

  segZoomIn()    { this.segMapScale.update(s => Math.min(Users.SEG_MAX_ZOOM, s * 1.25)); }
  segZoomOut()   { this.segMapScale.update(s => Math.max(Users.SEG_MIN_ZOOM, s / 1.25)); }
  segResetView() { this.segMapScale.set(1); this.segMapTx.set(0); this.segMapTy.set(0); }

  /** Rolls VPUs up by their classified segment for the right panel. */
  readonly segmentRollup = computed<SegmentRollup[]>(() => {
    const order: SegmentId[] = ['power', 'focused', 'onetime', 'low'];
    const data = this.vpuScatterData();
    return order.map(seg => {
      const vpus = data
        .filter(v => v.segment === seg)
        .sort((a, b) => b.activeUsers - a.activeUsers);
      const total = vpus.reduce((s, v) => s + v.activeUsers, 0);
      return { segment: seg, label: SEGMENT_LABEL[seg], vpus, total };
    });
  });

  /** Width fraction (0–1) of each segment row relative to the largest segment. */
  readonly maxSegmentTotal = computed(
    () => Math.max(...this.segmentRollup().map(s => s.total), 1),
  );

  readonly breakdownInsight = 'Power and focused usage is concentrated across regional and sector '
    + 'VPUs. These groups show deeper exploration patterns, higher prompt density, and stronger '
    + 'return behavior, suggesting K360 is most valuable where teams need multi-source synthesis, '
    + 'project lessons, and expert discovery.';

  /** Scatter dot screen coordinates + rendering metadata for the SVG. */
  readonly vpuDots = computed(() => {
    // Plot bounds: x in [padL, padL+plotW], y in [padT, padT+plotH].
    const xMin = this.padL;
    const xMax = this.padL + this.plotW;
    const yMin = this.padT;
    const yMax = this.padT + this.plotH;
    return this.vpuScatterData().map(v => {
      // Active users 20–300 → radius 3–6.5 (smaller dots).
      const r = 3 + ((v.activeUsers - 20) / 280) * 3.5;
      // Clamp cx/cy so the dot circle never crosses the plot border.
      const cx = Math.min(xMax - r, Math.max(xMin + r, this.toSvgX(v.conversations)));
      const cy = Math.min(yMax - r, Math.max(yMin + r, this.toSvgY(v.promptsPerSession)));
      return { ...v, cx, cy, r };
    });
  });

  // ---- Six summary cards ----
  readonly uniqueActiveUsers = {
    value: '3,095',
    sub: 'WBG staff · unique visitors',
    delta: '+12%',
    bottom: 'Jan – May 2026',
  };

  readonly adoptionRate = {
    pct: 16.73,
    delta: '+2.1% WoW',
    target: 'Progress to 50% target · Dec 2026',
    status: 'Lagging',
    denom: 'of ~9,000 WBG staff (IBRD ~6,000 · IFC ~3,000)',
  };

  readonly newVsReturning = {
    returning: 2923,
    newCount: 172,
    retention: '83.88%',
    bottom: '2,923 of 3,095 users returned',
  };

  readonly avgViews = {
    value: '3',
    delta: '+0.4',
    target: 'target >5 per user per month',
    bottom: 'views per user · Jan – May 2026',
  };

  readonly actionTakingUsers = {
    value: '62%',
    delta: '+6pp',
    sub: 'of users acted on a result',
    bottom: 'copied · saved · downloaded · liked',
  };

  // ---- Workflow Domain Split (KPT segmentation) ----
  readonly kptSegmentation: KptSegment[] = [
    {
      domain: 'knowledge', color: '#00C48C', label: 'Knowledge Seekers', pct: 49,
      sub: 'of active users primarily browsing lessons, collections, country context',
      bottom: '~1,517 users · Knowledge-domain queries dominant',
    },
    {
      domain: 'people', color: '#8B6FE8', label: 'Expertise Connectors', pct: 14,
      sub: 'of active users primarily using Sherlock and expert profiles',
      bottom: '~433 users · Sherlock · Expert Twin interactions',
    },
    {
      domain: 'tasks', color: '#38BDF8', label: 'Task Executors', pct: 37,
      sub: 'of active users primarily using TOR Genie, Grumpy Reviewer, Translate',
      bottom: '~1,145 users · TOR Genie dominant · 1,242 unique TOR Genie visitors',
    },
  ];

  // ---- Adoption Journey Funnel (right panel) ----
  // Bar colors mirror the persona scatter plot segments so each stage maps to where those users sit on the matrix.
  readonly funnelStages: FunnelStage[] = [
    { label: 'Discovery',            desc: 'First visit · awareness',          users:  172, pct:  6, color: '#a855f7' },
    { label: 'Exploration',          desc: '2–5 sessions · evaluating',        users:  891, pct: 29, color: '#fb923c' },
    { label: 'Repeat Usage',         desc: 'Returning within 30 days',         users: 2923, pct: 94, color: '#6366f1' },
    { label: 'Workflow Integration', desc: 'Task completion · embedded use',   users: 1242, pct: 40, color: '#6366f1' },
    { label: 'Dependency',           desc: 'Daily use · multiple agents',      users:  340, pct: 11, color: '#14b8a6' },
  ];

  // ---- Lower panels ----
  readonly vpuRows: VpuRow[] = [
    { name: 'AFWW1', visits: 100 },
    { name: 'AFCE2', visits: 92 },
    { name: 'AFCE1', visits: 86 },
    { name: 'AECE1', visits: 79 },
    { name: 'AECE2', visits: 74 },
    { name: 'GGODR', visits: 64 },
    { name: 'AECE3', visits: 55 },
    { name: 'SACFP', visits: 32 },
    { name: 'MNCGE', visits: 31 },
    { name: 'MNCPX', visits: 29 },
  ];
  readonly maxVpuVisits = 100;

  readonly coHq = {
    hqPct: 62,
    coPct: 38,
    hqUsers: '~1,919',
    coUsers: '~1,176',
  };

  readonly topCountries: CountryRow[] = [
    { name: 'United States', queries: 9669 },
    { name: 'India',         queries: 4100 },
    { name: 'Kenya',         queries:  429 },
    { name: 'Senegal',       queries:  407 },
    { name: 'Philippines',   queries:  294 },
    { name: 'Mali',          queries:  280 },
    { name: 'Ghana',         queries:  274 },
  ];

  readonly topRoles: RoleRow[] = [
    { role: 'Transport Specialist',                     time: 32.3, visitors: 1 },
    { role: 'Portfolio Officer',                        time: 23.5, visitors: 1 },
    { role: 'Governance Specialist',                    time: 19.0, visitors: 2 },
    { role: 'Senior Knowledge Management and Learning', time: 17.2, visitors: 6 },
    { role: 'Communications Officer',                   time: 15.8, visitors: 1 },
    { role: 'E T Consultant',                           time: 15.7, visitors: 13 },
    { role: 'Publishing Officer',                       time: 14.6, visitors: 1 },
    { role: 'Senior IT Officer Business Analysis',      time: 14.3, visitors: 1 },
    { role: 'IT Officer Business Solutions',            time: 14.2, visitors: 24 },
    { role: 'Senior Environmental Specialist',          time: 13.5, visitors: 1 },
  ];
  readonly maxRoleTime = 32.3;

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

// =============================================================================
// VPU catalogue + deterministic mock data for the scatter + segmentation panel.
// =============================================================================
const SEGMENT_LABEL: Record<SegmentId, string> = {
  power:   'Power Users',
  focused: 'Focused Users',
  onetime: 'One-Time Users',
  low:     'Low Engagement Users',
};

const VPUS: Vpu[] = [
  // Regions
  { code: 'AFE',  name: 'Eastern & Southern Africa',                      color: '#F97316' },
  { code: 'AFW',  name: 'Western & Central Africa',                       color: '#EAB308' },
  { code: 'EAP',  name: 'East Asia & Pacific',                            color: '#84CC16' },
  { code: 'ECA',  name: 'Europe & Central Asia',                          color: '#14B8A6' },
  { code: 'LAC',  name: 'Latin America & Caribbean',                      color: '#06B6D4' },
  { code: 'MNA',  name: 'Middle East & North Africa',                     color: '#EC4899' },
  { code: 'SAR',  name: 'South Asia',                                     color: '#A855F7' },
  // Sectors / Global Practices
  { code: 'AGR',  name: 'Agriculture & Food',                             color: '#65A30D' },
  { code: 'CC',   name: 'Climate Change',                                 color: '#059669' },
  { code: 'DD',   name: 'Digital Development',                            color: '#0EA5E9' },
  { code: 'EDU',  name: 'Education',                                      color: '#3B82F6' },
  { code: 'EEX',  name: 'Energy & Extractives',                           color: '#F59E0B' },
  { code: 'ENV',  name: 'Environment',                                    color: '#16A34A' },
  { code: 'FCI',  name: 'Finance, Competitiveness & Innovation',          color: '#6366F1' },
  { code: 'GOV',  name: 'Governance',                                     color: '#7C3AED' },
  { code: 'HNP',  name: 'Health, Nutrition & Population',                 color: '#F43F5E' },
  { code: 'MTI',  name: 'Macroeconomics, Trade & Investment',             color: '#DC2626' },
  { code: 'POV',  name: 'Poverty & Equity',                               color: '#CA8A04' },
  { code: 'SPJ',  name: 'Social Protection & Jobs',                       color: '#8B5CF6' },
  { code: 'SSI',  name: 'Social Sustainability & Inclusion',              color: '#D946EF' },
  { code: 'TRA',  name: 'Transport',                                      color: '#0891B2' },
  { code: 'URL',  name: 'Urban, Disaster Risk Management, Resilience & Land', color: '#DB2777' },
  { code: 'WAT',  name: 'Water',                                          color: '#2563EB' },
  // Support / Corporate
  { code: 'DEC',  name: 'Development Economics',                          color: '#475569' },
  { code: 'OPCS', name: 'Operations Policy & Country Services',           color: '#64748B' },
  { code: 'ITS',  name: 'Information & Technology Solutions',             color: '#6B7280' },
  { code: 'LEG',  name: 'Legal',                                          color: '#71717A' },
  { code: 'ECR',  name: 'External & Corporate Relations',                 color: '#737373' },
  { code: 'TRE',  name: 'Treasury',                                       color: '#57534E' },
  { code: 'HRD',  name: 'Human Resources',                                color: '#4B5563' },
  { code: 'IAD',  name: 'Internal Audit',                                 color: '#525252' },
  { code: 'IEG',  name: 'Independent Evaluation Group',                   color: '#3F3F46' },
];

const PROMPT_CATEGORIES = [
  'Policy synthesis', 'Country diagnostics', 'Sector research',
  'Expert discovery', 'Project lessons',
];
const COLLECTIONS = [
  'Water Resilience Toolkit', 'Climate Finance Notes', 'Governance Briefs',
  'Country Partnership Frameworks', 'Lessons Explorer',
];

// Deterministic pseudo-random in [lo, hi] derived from a string + offset so
// the scatter layout is stable across reloads but varied per VPU.
function pseudo(code: string, offset: number, lo: number, hi: number): number {
  let h = offset;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  const r = ((Math.sin(h) * 10000) % 1 + 1) % 1;  // 0..1
  return lo + r * (hi - lo);
}

// Per-period jitter so 30d / 60d / 90d show distinct dot positions and
// volumes. Drift is intentionally small so the motion reads as "this VPU
// has shifted a bit" rather than "completely repositioned".
const PERIOD_OFFSET: Record<Period, number> = { '30d': 0, '60d': 11, '90d': 23 };
const PERIOD_USER_MULT: Record<Period, number> = { '30d': 1, '60d': 1.2, '90d': 1.4 };

function buildVpuStats(period: Period): VpuStats[] {
  const po = PERIOD_OFFSET[period];
  return VPUS.map(v => {
    const baseConv = pseudo(v.code, 1, 3, 20);
    const basePps  = pseudo(v.code, 2, 3, 18);
    const baseUsers = pseudo(v.code, 3, 20, 300);

    // Period drift: subtle, deterministic, signed offset per VPU.
    const conv = Math.max(0, Math.min(20, Math.round(baseConv + pseudo(v.code, 10 + po, -1.2, 1.2))));
    const pps  = Math.max(0, Math.min(20, Math.round(basePps  + pseudo(v.code, 11 + po, -1.0, 1.0))));
    const users = Math.max(20, Math.round(baseUsers * PERIOD_USER_MULT[period]));

    const segment: SegmentId =
      conv >= 10 && pps >= 10 ? 'power'   :
      conv <  10 && pps >= 10 ? 'focused' :
      conv <  10 && pps <  10 ? 'onetime' : 'low';
    const topPromptCategory = PROMPT_CATEGORIES[Math.floor(pseudo(v.code, 4, 0, PROMPT_CATEGORIES.length))];
    const topCollection     = COLLECTIONS[Math.floor(pseudo(v.code, 5, 0, COLLECTIONS.length))];
    return { ...v, conversations: conv, promptsPerSession: pps, activeUsers: users, segment, topPromptCategory, topCollection };
  });
}

// =============================================================================
// Segment drawer mock data — keyed by SegmentId. Numbers are illustrative;
// the deeper roll-up belongs in the real data layer when it exists.
// =============================================================================

interface SegmentDrawerData {
  label: string;
  stats: { value: string; label: string }[];      // 6 cards
  vpuBreakdown: SegVpuRow[];                       // table
  promptCategories: Record<KptTab, SegPromptCategory[]>;
  collections: SegUsage[];
  agents: SegUsage[];
  mapIntensity: Record<string, number>;            // ISO → 0-6
  regionUsers: Record<string, number>;             // region code → users
  countryUsers: Record<string, number>;            // ISO → users
}

const SEGMENT_DRAWER_DATA: Record<SegmentId, SegmentDrawerData> = {
  power: {
    label: 'Power Users',
    stats: [
      { value: '2.1K', label: 'Total No. of Users' },
      { value: '78%',  label: 'Avg Conversations' },
      { value: '84%',  label: 'Avg Prompts/Session' },
      { value: '3',    label: 'Repeat Usage Rate' },
      { value: '78%',  label: 'Exploration Depth' },
      { value: '5',    label: 'Avg No. of Sessions/Week' },
    ],
    vpuBreakdown: [
      { code: 'AFCE1', pct: 24, growth: 18 },
      { code: 'GGODR', pct: 17, growth:  9 },
      { code: 'SACFP', pct: 11, growth: 22 },
    ],
    promptCategories: {
      knowledge: [
        { label: 'Flood Resilience Planning',       pct: 39, prompts: 198 },
        { label: 'Climate Adaptation & Resilience Strategies', pct: 24, prompts: 122 },
        { label: 'Water & Infrastructure Financing',            pct: 22, prompts: 112 },
        { label: 'Urban Resilience',                pct:  9, prompts:  46 },
        { label: 'Disaster Preparedness',           pct:  6, prompts:  30 },
      ],
      people: [
        { label: 'Peer Reviewer Discovery',  pct: 38, prompts: 78 },
        { label: 'Country Specialists',      pct: 26, prompts: 53 },
        { label: 'Sector SMEs',              pct: 18, prompts: 36 },
        { label: 'Mission Team Contacts',    pct: 10, prompts: 21 },
        { label: 'Cross-VPU Collaborators',  pct:  8, prompts: 16 },
      ],
      tasks: [
        { label: 'TOR Generation',                 pct: 54, prompts: 28 },
        { label: 'Project Concept Notes',          pct: 22, prompts: 16 },
        { label: 'Procurement Specifications',     pct: 10, prompts: 11 },
        { label: 'Synthesis Briefs',               pct:  8, prompts:  7 },
        { label: 'Slide Deck Outlines',            pct:  6, prompts:  5 },
      ],
    },
    collections: [
      { name: 'Country Growth and Jobs',         usage: 24 },
      { name: 'Debt Sustainability Analysis',    usage: 18 },
      { name: 'Global Economic Prospects',       usage: 14 },
      { name: 'Climate Action and Sustainability', usage: 11 },
    ],
    agents: [
      { name: 'Sherlock',           usage: 24 },
      { name: 'Lessons Explorer',   usage: 18 },
      { name: 'TOR Genie',          usage: 14 },
      { name: 'Literature Review',  usage: 11 },
    ],
    mapIntensity: {
      ke: 6, et: 5, tz: 5, za: 5, ng: 6,
      in: 6, bd: 5, pk: 4, id: 6, ph: 5,
      br: 5, mx: 5, co: 4, cn: 4, vn: 4,
    },
    regionUsers:  { afe: 240, afw: 180, eap: 310, eca:  85, lac: 210, mna: 140, sar: 300 },
    countryUsers: { ke: 78, et: 56, tz: 42, za: 64, ng: 96, in: 184, bd: 72, pk: 58, id: 88 },
  },

  focused: {
    label: 'Focused Users',
    stats: [
      { value: '1.4K', label: 'Total No. of Users' },
      { value: '52%',  label: 'Avg Conversations' },
      { value: '76%',  label: 'Avg Prompts/Session' },
      { value: '2',    label: 'Repeat Usage Rate' },
      { value: '64%',  label: 'Exploration Depth' },
      { value: '3',    label: 'Avg No. of Sessions/Week' },
    ],
    vpuBreakdown: [
      { code: 'AECE2', pct: 22, growth: 14 },
      { code: 'GTRGE', pct: 16, growth:  8 },
      { code: 'GENGL', pct: 12, growth: 12 },
    ],
    promptCategories: {
      knowledge: [
        { label: 'Project Lessons Review',       pct: 48, prompts: 26 },
        { label: 'Country Economic Briefings',   pct: 22, prompts: 18 },
        { label: 'Sector Diagnostics',           pct: 12, prompts: 12 },
        { label: 'Policy Note Drafting',         pct: 10, prompts:  9 },
        { label: 'Working Paper Summaries',      pct:  8, prompts:  7 },
      ],
      people: [
        { label: 'Expert Profile Lookup',        pct: 50, prompts: 22 },
        { label: 'TTL Discovery',                pct: 24, prompts: 15 },
        { label: 'Specialist Identification',    pct: 14, prompts: 10 },
        { label: 'Cross-Region Matches',         pct:  7, prompts:  6 },
        { label: 'Cross-VPU Matches',            pct:  5, prompts:  4 },
      ],
      tasks: [
        { label: 'TOR Concept Notes',            pct: 46, prompts: 24 },
        { label: 'Mission Briefs',               pct: 24, prompts: 14 },
        { label: 'Synthesis Decks',              pct: 16, prompts: 10 },
        { label: 'Concept Reviews',              pct:  8, prompts:  6 },
        { label: 'Donor Pitch Drafts',           pct:  6, prompts:  4 },
      ],
    },
    collections: [
      { name: 'Country Partnership Frameworks',  usage: 22 },
      { name: 'Lessons Explorer',                usage: 18 },
      { name: 'IFC Sector Notes',                usage: 14 },
      { name: 'Macro Poverty Outlook',           usage:  9 },
    ],
    agents: [
      { name: 'Sherlock',          usage: 30 },
      { name: 'Lessons Explorer',  usage: 22 },
      { name: 'TOR Genie',         usage: 12 },
      { name: 'WBG Translate',     usage:  6 },
    ],
    mapIntensity: {
      ke: 5, et: 4, tz: 4, za: 5, ng: 5,
      in: 5, bd: 4, pk: 4, id: 5, ph: 4,
      br: 5, mx: 4, co: 3, cn: 4, vn: 3,
    },
    regionUsers:  { afe: 180, afw: 130, eap: 200, eca:  70, lac: 150, mna:  90, sar: 220 },
    countryUsers: { ke: 52, et: 38, tz: 30, za: 48, ng: 64, in: 122, bd: 50, pk: 42, id: 64 },
  },

  onetime: {
    label: 'One-Time Users',
    stats: [
      { value: '2.6K', label: 'Total No. of Users' },
      { value: '24%',  label: 'Avg Conversations' },
      { value: '32%',  label: 'Avg Prompts/Session' },
      { value: '1',    label: 'Repeat Usage Rate' },
      { value: '28%',  label: 'Exploration Depth' },
      { value: '1',    label: 'Avg No. of Sessions/Week' },
    ],
    vpuBreakdown: [
      { code: 'AFCW2', pct: 18, growth:  6 },
      { code: 'MNCGE', pct: 14, growth:  4 },
      { code: 'SACPK', pct:  9, growth:  3 },
    ],
    promptCategories: {
      knowledge: [
        { label: 'Quick Country Facts',          pct: 56, prompts: 22 },
        { label: 'One-off Sector Lookups',       pct: 22, prompts: 11 },
        { label: 'Definition Queries',           pct: 10, prompts:  6 },
        { label: 'Statistic Snapshots',          pct:  7, prompts:  4 },
        { label: 'Acronym Resolution',           pct:  5, prompts:  3 },
      ],
      people: [
        { label: 'Single Expert Lookups',        pct: 60, prompts: 18 },
        { label: 'TTL Contact Search',           pct: 22, prompts:  9 },
        { label: 'Org-chart Queries',            pct: 10, prompts:  5 },
        { label: 'Country Manager Lookup',       pct:  5, prompts:  3 },
        { label: 'Past-team Recall',             pct:  3, prompts:  2 },
      ],
      tasks: [
        { label: 'One-off TOR Draft',            pct: 50, prompts: 14 },
        { label: 'Single Translation',           pct: 24, prompts:  8 },
        { label: 'Quick Summary',                pct: 14, prompts:  5 },
        { label: 'Single Slide',                 pct:  8, prompts:  3 },
        { label: 'Email Draft',                  pct:  4, prompts:  2 },
      ],
    },
    collections: [
      { name: 'World Development Report',        usage: 18 },
      { name: 'Country Briefs',                  usage: 16 },
      { name: 'Sector Snapshots',                usage: 12 },
      { name: 'Glossary',                        usage:  8 },
    ],
    agents: [
      { name: 'Sherlock',          usage: 20 },
      { name: 'WBG Translate',     usage: 18 },
      { name: 'TOR Genie',         usage: 10 },
      { name: 'Grumpy Reviewer',   usage:  6 },
    ],
    mapIntensity: {
      us: 3, ca: 2, gb: 3, fr: 3, de: 3, it: 2, jp: 2,
      au: 2, br: 3, mx: 3, in: 4, id: 3, ph: 3,
    },
    regionUsers:  { afe: 90, afw: 70, eap: 120, eca: 50, lac: 80, mna: 50, sar: 110 },
    countryUsers: { us: 56, ca: 22, gb: 38, fr: 26, de: 30, jp: 18, br: 36, mx: 32, in: 70, id: 38 },
  },

  low: {
    label: 'Low Engagement Users',
    stats: [
      { value: '1.9K', label: 'Total No. of Users' },
      { value: '34%',  label: 'Avg Conversations' },
      { value: '28%',  label: 'Avg Prompts/Session' },
      { value: '1',    label: 'Repeat Usage Rate' },
      { value: '18%',  label: 'Exploration Depth' },
      { value: '1',    label: 'Avg No. of Sessions/Week' },
    ],
    vpuBreakdown: [
      { code: 'AECE3', pct: 21, growth:  5 },
      { code: 'SACPK', pct: 14, growth:  3 },
      { code: 'AFCW1', pct: 12, growth:  2 },
    ],
    promptCategories: {
      knowledge: [
        { label: 'Single-Page Lookups',          pct: 52, prompts: 18 },
        { label: 'Indicator Definitions',        pct: 22, prompts:  9 },
        { label: 'Country Snapshot',             pct: 14, prompts:  6 },
        { label: 'Sector Acronyms',              pct:  8, prompts:  4 },
        { label: 'Glossary Hits',                pct:  4, prompts:  3 },
      ],
      people: [
        { label: 'Manager Lookup',               pct: 58, prompts: 16 },
        { label: 'Org-chart Browse',             pct: 22, prompts:  8 },
        { label: 'Vacated Team Recall',          pct: 10, prompts:  4 },
        { label: 'Past Contact',                 pct:  6, prompts:  3 },
        { label: 'Unit Lookups',                 pct:  4, prompts:  2 },
      ],
      tasks: [
        { label: 'Quick Translation',            pct: 60, prompts: 18 },
        { label: 'Snippet Summary',              pct: 22, prompts:  8 },
        { label: 'Single TOR Page',              pct: 10, prompts:  5 },
        { label: 'Email Draft',                  pct:  5, prompts:  2 },
        { label: 'Acronym Decode',               pct:  3, prompts:  1 },
      ],
    },
    collections: [
      { name: 'Glossary & Acronyms',             usage: 22 },
      { name: 'Country Briefs',                  usage: 18 },
      { name: 'Indicator Library',               usage: 14 },
      { name: 'Sector Snapshots',                usage: 10 },
    ],
    agents: [
      { name: 'WBG Translate',     usage: 32 },
      { name: 'Sherlock',          usage: 18 },
      { name: 'TOR Genie',         usage:  8 },
      { name: 'Lessons Explorer',  usage:  6 },
    ],
    mapIntensity: {
      us: 2, ca: 1, gb: 2, fr: 1, de: 1, ru: 1, tr: 1,
      au: 1, br: 2, mx: 2, in: 2, id: 1, ph: 1,
    },
    regionUsers:  { afe: 60, afw: 50, eap: 80, eca: 40, lac: 60, mna: 40, sar: 70 },
    countryUsers: { us: 42, gb: 22, fr: 14, de: 18, br: 22, mx: 18, in: 38, id: 24 },
  },
};

// Compact ISO → region lookup for map tinting in the segment drawer.
const ISO_TO_REGION_LITE: Record<string, string> = {
  ke: 'afe', et: 'afe', tz: 'afe', ug: 'afe', rw: 'afe', za: 'afe', mg: 'afe', mz: 'afe', zw: 'afe', cd: 'afe',
  ng: 'afw', gh: 'afw', sn: 'afw', ci: 'afw', cm: 'afw',
  in: 'sar', bd: 'sar', pk: 'sar', np: 'sar', lk: 'sar', af: 'sar',
  cn: 'eap', id: 'eap', ph: 'eap', vn: 'eap', th: 'eap', kh: 'eap', mm: 'eap',
  br: 'lac', mx: 'lac', ar: 'lac', co: 'lac', pe: 'lac', cl: 'lac',
  eg: 'mna', ma: 'mna', tn: 'mna', dz: 'mna',
  ua: 'eca', tr: 'eca', kz: 'eca', uz: 'eca',
};

const REGION_LABEL: Record<string, string> = {
  afe: 'Eastern & Southern Africa (AFE)',
  afw: 'Western & Central Africa (AFW)',
  eap: 'East Asia & Pacific (EAP)',
  eca: 'Europe & Central Asia (ECA)',
  lac: 'Latin America & Caribbean (LAC)',
  mna: 'Middle East & North Africa (MNA)',
  sar: 'South Asia Region (SAR)',
};

const COUNTRY_LABEL: Record<string, string> = {
  ke: 'Kenya', et: 'Ethiopia', tz: 'Tanzania', za: 'South Africa', ng: 'Nigeria',
  in: 'India',  bd: 'Bangladesh', pk: 'Pakistan', np: 'Nepal',
  br: 'Brazil', mx: 'Mexico', co: 'Colombia',
  id: 'Indonesia', ph: 'Philippines', vn: 'Vietnam', cn: 'China',
  eg: 'Egypt', ma: 'Morocco', tr: 'Türkiye',
  us: 'United States', ca: 'Canada', gb: 'United Kingdom', fr: 'France', de: 'Germany', jp: 'Japan', au: 'Australia',
};
