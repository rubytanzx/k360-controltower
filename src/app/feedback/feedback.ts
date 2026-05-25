import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { HierFilter } from '../shared/hier-filter/hier-filter';
import {
  REGION_GROUPS, VPU_GROUPS, regionCountrySelectionFromParams,
} from '../shared/hier-filter/hier-filter-catalog';
import { DateRangeFilter } from '../shared/date-range-filter/date-range-filter';

type Workspace = 'wb' | 'ifc';
type HeatmapMode = 'region' | 'vpu';

interface KpiMetric { value: string; label?: string; delta?: string; }
interface PageKpi   { title: string; metrics: KpiMetric[]; sub?: string; }

interface FlaggedCategory {
  id: string;
  name: string;
  pct: number;       // size in treemap (share of flagged volume)
  count: number;     // negative responses
  color: string;
  trending?: boolean;
}

interface FlaggedCollection {
  rank: number;
  title: string;
  prompts: number;
  negativePct: number;
}

type FeedbackTypeIcon =
  | 'alert-triangle'
  | 'message-report'
  | 'circle-x'
  | 'arrows-shuffle'
  | 'target';

interface NegativeFeedbackType {
  title: string;
  reports: number;
  sharePct: number;     // share of all negatives
  icon: FeedbackTypeIcon;
}

interface HeatmapCell {
  /** 0..1 intensity */
  value: number;
}

@Component({
  selector: 'app-feedback',
  imports: [TablerIconComponent, RouterLink, HierFilter, DateRangeFilter],
  templateUrl: './feedback.html',
  styleUrl: './feedback.css',
})
export class Feedback {
  // ---- Workspace toggle (WB / IFC) ----
  readonly workspace = signal<Workspace>('wb');
  setWorkspace(w: Workspace) { this.workspace.set(w); }

  // ---- Hierarchical filter catalogs ----
  readonly regionGroups = REGION_GROUPS;
  readonly vpuGroups    = VPU_GROUPS;

  /** Pre-applied Region/Country from `?region=…` / `?country=…` query params
   *  written by the dashboard country drawer's "View Feedback" link. Seeds the
   *  HierFilter on entry so users land with their drawer country pre-filtered. */
  readonly initialRegionCountry = (() => {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    return regionCountrySelectionFromParams({ region: q.get('region'), country: q.get('country') });
  })();

  // ---- Top KPI row — K360 Master Data Extract (Power BI Jan 1 – May 19, 2026) ----
  // 3,095 unique visitors / 30,020 page views; ~28% of visitors leave feedback;
  // 1,496 ≈ 5% of page views ⇒ feedback rate ~25% per AI response.
  readonly activeUsers = { value: '3,095', delta: '+12%', sub: 'of ~18,500 WBG staff' };
  readonly uniqueWithFeedback = { value: '28%', delta: '+3pp', sub: '870 staff left feedback' };
  readonly totalFeedback = {
    value: '1,496',
    positivePct: 72,
    negativePct: 28,
  };

  // ---- Card 1: Most Flagged Prompt Categories (treemap) ----
  // Same colour language as the Prompts page treemap; pct drives cell size,
  // count is negative responses received in this category.
  readonly flaggedCategories: FlaggedCategory[][] = [
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

  rowFlex = (row: FlaggedCategory[]) => row.reduce((s, t) => s + t.pct, 0);

  // ---- Card 2: Most Flagged Collections (ranked list with % bar) ----
  // Names match K360 featured / largest collections from the Master Data Extract.
  readonly flaggedCollections: FlaggedCollection[] = [
    { rank: 1, title: 'Policy Research Working Papers', prompts: 184, negativePct: 31 },
    { rank: 2, title: 'Country Economic Updates',       prompts: 142, negativePct: 26 },
    { rank: 3, title: 'IFC Insights and Reports',       prompts:  98, negativePct: 22 },
  ];

  // ---- Card 3: Top Negative Feedback Type (categorical, with icons) ----
  readonly topNegativeTypes: NegativeFeedbackType[] = [
    { title: 'Not factually correct',       reports: 412, sharePct: 38, icon: 'alert-triangle' },
    { title: 'Missing source citations',    reports: 287, sharePct: 27, icon: 'message-report' },
    { title: 'Did not follow instructions', reports: 196, sharePct: 18, icon: 'target' },
  ];

  // ---- Feedback Volume Trend (line chart, Jan-Dec) ----
  readonly months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  readonly yAxisTicks = [0, 20, 40, 60, 80, 100];

  // SVG viewBox 720 wide x 260 tall, plot area uses padding
  readonly chartW = 720;
  readonly chartH = 260;
  readonly padL = 36;
  readonly padR = 16;
  readonly padT = 16;
  readonly padB = 36;

  /** Pre-computed positive series values across 12 months. */
  private readonly positiveSeries = [32, 38, 30, 35, 28, 36, 50, 64, 70, 72, 70, 68];
  private readonly negativeSeries = [8, 12, 11, 14, 10, 11, 16, 24, 18, 25, 18, 14];

  private toX(i: number): number {
    const plotW = this.chartW - this.padL - this.padR;
    return this.padL + (i / (this.months.length - 1)) * plotW;
  }
  private toY(v: number): number {
    const plotH = this.chartH - this.padT - this.padB;
    return this.padT + (1 - v / 100) * plotH;
  }

  /** Build a smooth Catmull-Rom-style bezier path through the points. */
  private smoothPath(values: number[]): string {
    const pts = values.map((v, i) => ({ x: this.toX(i), y: this.toY(v) }));
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }

  readonly positiveLinePath = computed(() => this.smoothPath(this.positiveSeries));
  readonly negativeLinePath = computed(() => this.smoothPath(this.negativeSeries));

  readonly positiveAreaPath = computed(() => {
    const base = this.positiveLinePath();
    const lastX = this.toX(this.months.length - 1);
    const firstX = this.toX(0);
    const baseY = this.chartH - this.padB;
    return `${base} L ${lastX.toFixed(1)},${baseY} L ${firstX.toFixed(1)},${baseY} Z`;
  });

  readonly negativeAreaPath = computed(() => {
    const base = this.negativeLinePath();
    const lastX = this.toX(this.months.length - 1);
    const firstX = this.toX(0);
    const baseY = this.chartH - this.padB;
    return `${base} L ${lastX.toFixed(1)},${baseY} L ${firstX.toFixed(1)},${baseY} Z`;
  });

  // X-axis tick positions
  readonly xTicks = computed(() => this.months.map((m, i) => ({ label: m, x: this.toX(i) })));

  // Y-axis tick positions
  readonly yTicks = computed(() => this.yAxisTicks.map(v => ({ label: v, y: this.toY(v) })));

  // ---- Heatmap: Feedback Friction Areas by Topic Category ----
  readonly heatmapMode = signal<HeatmapMode>('region');
  setHeatmapMode(m: HeatmapMode) { this.heatmapMode.set(m); }

  // Each heat-map column maps to a topic id consumed by the Analysis page
  // (see /prompts/analysis ?topic=…). The two-line `label` is split on `\n`
  // by the column-label template.
  readonly heatmapColumns: { label: string; topicId: string }[] = [
    { label: 'Ghana Economic\nGrowth',    topicId: 'eg' },
    { label: 'Morocco Labor\nMarkets',    topicId: 'ml' },
    { label: 'Climate &\nInfrastructure', topicId: 'cli-adapt' },
    { label: 'TOR\nGeneration',           topicId: 'tor' },
    { label: 'Housing &\nFinance',        topicId: 'hf' },
  ];

  // WBG operating regions (matches Power BI region groupings).
  readonly heatmapRowsRegion = ['SAR', 'AFW', 'AFE', 'EAP'];
  // Real VPU codes from Power BI Adoption-by-VPU table.
  readonly heatmapRowsVpu    = ['AFWW1', 'AFCE2', 'AFCE1', 'AECE1'];

  // Intensity per (row, col). 0 = lightest, 1 = darkest red.
  // Match the mockup tones.
  private readonly heatmapDataRegion: number[][] = [
    // LATAM: lightest, with one mid-yellow on Housing & Finance
    [0.08, 0.10, 0.10, 0.10, 0.40],
    // APAC: light yellow, with one yellow on Ghana
    [0.32, 0.10, 0.10, 0.08, 0.10],
    // EMEA: stronger pop — yellow on Climate, deep red on Expertise in Energy
    [0.10, 0.30, 0.90, 0.10, 0.10],
    // North America: orange on Climate & Infrastructure
    [0.10, 0.55, 0.10, 0.10, 0.10],
  ];

  private readonly heatmapDataVpu: number[][] = [
    [0.10, 0.45, 0.20, 0.15, 0.30],
    [0.50, 0.10, 0.15, 0.20, 0.10],
    [0.15, 0.25, 0.85, 0.10, 0.10],
    [0.10, 0.65, 0.10, 0.30, 0.20],
  ];

  readonly heatmapRows = computed(() =>
    this.heatmapMode() === 'region' ? this.heatmapRowsRegion : this.heatmapRowsVpu,
  );

  readonly heatmapData = computed(() =>
    this.heatmapMode() === 'region' ? this.heatmapDataRegion : this.heatmapDataVpu,
  );

  /** Map intensity 0..1 to a CSS color along light yellow → red. */
  heatColor(v: number): string {
    // Threshold below which we use a near-transparent yellow.
    if (v < 0.15) return '#FEF3C7';
    if (v < 0.35) return '#FDE68A';
    if (v < 0.55) return '#FCD34D';
    if (v < 0.75) return '#F59E0B';
    return '#DC2626';
  }
}
