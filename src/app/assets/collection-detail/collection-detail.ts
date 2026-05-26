import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';

type KptTab = 'knowledge' | 'people' | 'tasks';
type SortDir = 'asc' | 'desc';
type ResourceSortKey = 'name' | 'type' | 'uploaded' | 'retrievals' | 'utilization' | 'negative' | 'positive';
type PromptSortKey = 'name' | 'negative' | 'positive';
type DrawerView = 'resource' | 'prompt';
type ContributionMode = 'vpu' | 'country';

interface ContributionSlice {
  label: string;
  fullName: string;   // Tooltip text — for VPU codes this expands to the unit name.
  count: number;
  pct: number;
  color: string;
  pathD: string;
}

/** VPU code → full unit name. Sourced from the Power BI Adoption-by-VPU table
 *  and the existing mapping in users.ts. Falls back to the code itself when
 *  unknown so the tooltip is never empty. */
const VPU_FULL_NAMES: Record<string, string> = {
  AFWW1: 'Western & Central Africa — Country Unit 1',
  AFCE1: 'Eastern & Southern Africa — Country Unit 1',
  AFCE2: 'Eastern & Southern Africa — Country Unit 2',
  AECE1: 'Eastern & Southern Africa — Country Operations 1',
  AECE2: 'Eastern & Southern Africa — Country Operations 2',
  AECE3: 'Eastern & Southern Africa — Country Operations 3',
  GGODR: 'Global Governance — Operations & Delivery',
  SACFP: 'South Asia — Country Fiscal & Policy',
  MNCGE: 'MENA — Country Governance & Economics',
  MNCPX: 'MENA — Country Practice Unit',
  MNCMU: 'MENA — Country Macro Unit',
  EACES: 'East Asia & Pacific — Country Economics & Strategy',
  AFCW2: 'Western & Central Africa — Country Unit 2',
};

/** A user-prompt *type* — i.e. many submissions that share the same intent
 *  against this resource. Carries the aggregated feedback shown in the
 *  prompt detail drawer view: total positive/negative counts plus a
 *  breakdown of negatives across the five standard reason labels. */
interface NegReasonCount { label: string; count: number; }
interface UserPrompt {
  text: string;
  negative: number;     // % of submissions that gave a thumbs-down
  positive: number;     // % of submissions that gave a thumbs-up
  positiveCount: number;
  negativeCount: number;
  /** Fixed length 5, ordered: instructions, factual, offensive, language, other. */
  negativeBreakdown: NegReasonCount[];
  /** Free-text comments captured when a user picked "Other" as the reason. */
  otherComments: string[];
}

/** Standard reason labels used in the negative-feedback breakdown. Mirrors
 *  the analysis page so the two views stay in lockstep. */
const NEG_REASON_LABELS = [
  'Did not Follow Instructions',
  'Not Factually Correct',
  'Offensive/Unsafe',
  'Wrong Language',
  'Other',
] as const;

interface KpiMetric { value: string; label?: string; delta?: string; }
interface PromptCategory { label: string; pct: number; prompts: number; }
interface ResourceRow {
  name: string;
  type: string;
  uploaded: string;          // ISO yyyy-mm-dd for sort
  uploadedDisplay: string;   // pre-formatted
  retrievals: number;        // 0-100 %
  utilization: number;       // 0-100 %
  negative: number;          // count
  positive: number;          // count
  // Provenance — captured at upload time. VPU = contributing unit code,
  // country = ISO label of the contributing country.
  vpu: string;
  country: string;
}

const SLUG_TO_NAME: Record<string, string> = {
  // Original Assets-canvas collections
  'climate-adaptation-financing-framework':  'Climate Adaptation Financing Framework',
  'water-resilience-toolkit':                'Water Resilience Toolkit',
  'urban-flooding-drainage-reports':         'Urban Flooding & Drainage Reports',
  'digital-public-infrastructure-playbook':  'Digital Public Infrastructure Playbook',
  'ai-readiness-country-assessments':        'AI Readiness Country Assessments',
  'health-systems-resilience-notes':         'Health Systems Resilience Notes',
  'education-technology-deployment-cases':   'Education Technology Deployment Cases',
  'debt-sustainability-analysis-repository': 'Debt Sustainability Analysis Repository',
  'sme-growth-and-jobs-repository':          'SME Growth and Jobs Repository',
  // Dashboard country-drawer collections (real K360 collections)
  'climate-adaptation-toolkit': 'Climate Adaptation Toolkit',
  'water-policy-notes':         'Water Policy Notes',
  'debt-sustainability-analysis': 'Debt Sustainability Analysis',
  'regional-energy-strategy':   'Regional Energy Strategy',
  'trade-corridor-studies':     'Trade Corridor Studies',
  'education-sector-notes':     'Education Sector Notes',
  // Analysis-page collections (real K360 featured collections)
  'country-growth-and-jobs':    'Country Growth and Jobs',
  'fiscal-policy-and-growth':   'Fiscal Policy and Growth',
  'macro-poverty-outlook':      'Macro Poverty Outlook',
  'country-economic-updates':   'Country Economic Updates',
  'public-finance-review':      'Public Finance Review',
  'other-collections':          'Other Collections',
  // People-domain collections
  'staff-expertise-directory':  'Staff Expertise Directory',
  'project-team-histories':     'Project Team Histories',
  'mission-and-btor-archives':  'Mission & BTOR Archives',
  'country-operations-metadata': 'Country Operations Metadata',
  'communities-of-practice':    'Communities of Practice',
  'external-publications':      'External Publications',
  // Tasks-domain collections
  'tor-library':                 'TOR Library',
  'tor-genie-templates':         'TOR Genie Templates',
  'project-concept-notes-archive': 'Project Concept Notes Archive',
  'standard-specifications':     'Standard Specifications',
  'operations-policy-library':   'Operations Policy Library',
  'procurement-notices-archive': 'Procurement Notices Archive',
  'knowledge-notes':             'Knowledge Notes',
  // Lessons Explorer-related
  'icrr-archive':                'ICRR Archive',
  'ppar-database':               'PPAR Database',
  'performance-and-learning-reviews': 'Performance and Learning Reviews',
  'ieg-independent-review':      'IEG Independent Review',
  // Other K360 featured
  'policy-research-working-papers': 'Policy Research Working Papers',
  'ifc-insights-and-reports':       'IFC Insights and Reports',
};

@Component({
  selector: 'app-collection-detail',
  imports: [TablerIconComponent, RouterLink],
  templateUrl: './collection-detail.html',
  styleUrl: './collection-detail.css',
})
export class CollectionDetail {
  private readonly route = inject(ActivatedRoute);

  readonly slug = signal<string>(this.route.snapshot.paramMap.get('slug') ?? 'water-resilience-toolkit');
  readonly name = computed(() => SLUG_TO_NAME[this.slug()] ?? 'Water Resilience Toolkit');

  // ----- header metadata pills -----
  readonly meta = {
    type:      'Strategic Toolkit',
    verticals: 'Infrastructure, Finance',
    updated:   '2 hours ago',
    sectors:   'Water, Climate',
  };

  // ----- KPI cards -----
  // Numbers illustrative for the Water Resilience Toolkit collection;
  // feedback split now sums to 100% (was 105% — math bug).
  readonly kpis: { title: string; metrics: KpiMetric[]; sub?: string; feedback?: { positive: number; negative: number } }[] = [
    {
      title: 'Total Queries',
      metrics: [{ value: '847', delta: '+12%' }],
    },
    {
      title: 'Knowledge Coverage',
      metrics: [{ value: '67%', delta: '+4pp' }],
      sub: 'of answers cite this collection',
    },
    {
      title: 'Resources with Feedback Interaction',
      metrics: [{ value: '78%', delta: '+3pp vs last month' }],
      feedback: { positive: 72, negative: 28 },
    },
    {
      title: 'VPU Usage',
      metrics: [{ value: '28' }],
      sub: 'of 69 VPUs accessed this collection',
    },
  ];

  // ----- Top Prompt Categories (tabbed treemap) -----
  readonly activeTab = signal<KptTab>('knowledge');
  readonly tabDefs: { id: KptTab; label: string }[] = [
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'people',    label: 'People' },
    { id: 'tasks',     label: 'Tasks' },
  ];
  // Per-tab subcategory split. pct sums to 100% per tab. prompts is the
  // absolute count behind each share — higher pct = more prompts.
  readonly categoriesByTab: Record<KptTab, PromptCategory[]> = {
    knowledge: [
      { label: 'Flood Resilience Planning',      pct: 39, prompts: 198 },
      { label: 'Climate Adaptation & Resilience Strategies', pct: 24, prompts: 122 },
      { label: 'Water & Infrastructure Financing',            pct: 22, prompts: 112 },
      { label: 'Urban Resilience',               pct:  9, prompts:  46 },
      { label: 'Disaster Preparedness',          pct:  6, prompts:  30 },
    ],
    people: [
      { label: 'Water Resources Specialists',    pct: 48, prompts: 100 },
      { label: 'Climate Adaptation & Resilience Leads', pct: 28, prompts:  59 },
      { label: 'Hydrologists',                   pct: 12, prompts:  25 },
      { label: 'Urban Planners',                 pct:  7, prompts:  15 },
      { label: 'M&E Specialists',                pct:  5, prompts:  10 },
    ],
    tasks: [
      { label: 'TOR: Water Sector Diagnostic',   pct: 52, prompts:  66 },
      { label: 'Project Concept Notes',          pct: 22, prompts:  28 },
      { label: 'Synthesis: Drought Response',    pct: 14, prompts:  18 },
      { label: 'Briefs: Climate Adaptation & Resilience', pct:  7, prompts:   9 },
      { label: 'Slides: Resilience Outcomes',    pct:  5, prompts:   6 },
    ],
  };
  readonly activeCategories = computed(() => this.categoriesByTab[this.activeTab()]);

  // ----- Contribution pie (By VPU / By Country) -----
  // Aggregates this collection's resources by their `vpu` or `country`
  // provenance field, sorts desc by count, and builds the SVG slice path
  // data right here so the template can render each <path> directly.
  readonly contributionMode = signal<ContributionMode>('vpu');
  setContributionMode(m: ContributionMode) { this.contributionMode.set(m); }

  // Distinct hue per slice so each contributor reads at a glance, rather than
  // a monochrome teal ramp where adjacent slices blur together. Ordered most
  // saturated → softest so the top contributor pops; everything stays in the
  // same lightness band so no single slice fights the others for attention.
  private static readonly CONTRIBUTION_PALETTE = [
    '#E879F9', // fuchsia / magenta
    '#A78BFA', // violet
    '#67E8F9', // cyan
    '#34D399', // emerald
    '#A5B4FC', // indigo
    '#FCD34D', // amber
    '#FB7185', // rose
    '#22D3EE', // sky
  ];

  readonly contributionSlices = computed<ContributionSlice[]>(() => {
    const mode = this.contributionMode();
    const counts: Record<string, number> = {};
    for (const r of this.resources) {
      const key = mode === 'vpu' ? r.vpu : r.country;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    if (total === 0) return [];
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // Build slice paths: start at -π/2 (12 o'clock) and walk clockwise.
    const cx = 50, cy = 50, r = 40;
    let cumulative = 0;
    const palette = CollectionDetail.CONTRIBUTION_PALETTE;
    return entries.map(([label, count], i) => {
      const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
      const endAngle = ((cumulative + count) / total) * 2 * Math.PI - Math.PI / 2;
      cumulative += count;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      // Edge case: a single slice would have start==end; render as full circle.
      const pathD = entries.length === 1
        ? `M ${cx - r},${cy} A ${r},${r} 0 1 1 ${cx + r},${cy} A ${r},${r} 0 1 1 ${cx - r},${cy} Z`
        : `M ${cx},${cy} L ${x1.toFixed(2)},${y1.toFixed(2)} A ${r},${r} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
      return {
        label,
        // Country mode already shows the human-readable name; VPU mode shows
        // the code in the legend and expands to the full unit name on hover.
        fullName: mode === 'vpu' ? (VPU_FULL_NAMES[label] ?? label) : label,
        count,
        pct: Math.round((count / total) * 100),
        color: palette[i % palette.length],
        pathD,
      };
    });
  });

  // ----- Knowledge Coverage donut -----
  // Circumference for r=40 → 2π·40 ≈ 251.327
  private static readonly DONUT_CIRC = 251.327;
  readonly coverage = { totalFiles: 2345, cited: 40, referenced: 27, notRetrieved: 33 };
  readonly donutCirc = CollectionDetail.DONUT_CIRC;
  readonly donutCited       = computed(() => (this.coverage.cited       / 100) * this.donutCirc);
  readonly donutReferenced  = computed(() => (this.coverage.referenced  / 100) * this.donutCirc);
  readonly donutNotRetrieved = computed(() => (this.coverage.notRetrieved / 100) * this.donutCirc);
  // Offsets for sequential placement around the circle
  readonly donutOffsetReferenced  = computed(() => -this.donutCited());
  readonly donutOffsetNotRetrieved = computed(() => -(this.donutCited() + this.donutReferenced()));

  // ----- Resources table -----
  // VPU + Country are the new contribution-provenance fields. VPU codes
  // taken from the Power BI Adoption-by-VPU table; country is the
  // originating client country tagged at upload.
  readonly resources: ResourceRow[] = [
    { name: 'Flood Resilience Financing.pdf',  type: 'Framework', uploaded: '2026-05-14', uploadedDisplay: 'May 14, 2026', retrievals: 82, utilization: 95, negative: 6400, positive: 6400, vpu: 'AFWW1', country: 'Ghana' },
    { name: 'Urban Drainage Strategy 2024.docx', type: 'Strategy', uploaded: '2026-05-12', uploadedDisplay: 'May 12, 2026', retrievals: 79, utilization: 35, negative: 5900, positive: 5900, vpu: 'AFWW1', country: 'Senegal' },
    { name: 'Drought Resilience Case Studies',  type: 'Web Link',  uploaded: '2026-05-10', uploadedDisplay: 'May 10, 2026', retrievals: 74, utilization: 86, negative: 4800, positive: 4800, vpu: 'AFCE1', country: 'Kenya' },
    { name: 'Digital Public Infrastructure Playbook', type: 'Playbook', uploaded: '2026-04-12', uploadedDisplay: 'Apr 12, 2026', retrievals: 88, utilization: 56, negative: 3000, positive: 3000, vpu: 'AFWW1', country: 'Ghana' },
    { name: 'AI Readiness Country Assessments', type: 'Assessment', uploaded: '2026-04-06', uploadedDisplay: 'Apr 6, 2026',  retrievals: 71, utilization: 43, negative: 2900, positive: 2900, vpu: 'MNCGE', country: 'Morocco' },
    { name: 'Health Systems Resilience Notes',  type: 'Notes',      uploaded: '2026-04-06', uploadedDisplay: 'Apr 6, 2026',  retrievals: 77, utilization: 93, negative: 2000, positive: 2000, vpu: 'AFCE2', country: 'Tanzania' },
    { name: 'Education Technology Deployment Cases', type: 'Case Studies', uploaded: '2026-04-04', uploadedDisplay: 'Apr 4, 2026', retrievals: 75, utilization: 82, negative: 1200, positive: 1200, vpu: 'AECE1', country: 'Ethiopia' },
    { name: 'Debt Sustainability Analysis Repository', type: 'Repository', uploaded: '2026-04-02', uploadedDisplay: 'Apr 2, 2026', retrievals: 84, utilization: 68, negative: 1100, positive: 1100, vpu: 'MNCGE', country: 'Egypt' },
    { name: 'SME Growth and Jobs Repository',  type: 'Repository', uploaded: '2026-04-01', uploadedDisplay: 'Apr 1, 2026',  retrievals: 69, utilization: 52, negative: 1000, positive: 1000, vpu: 'SACFP', country: 'India' },
  ];

  readonly resSortKey = signal<ResourceSortKey>('retrievals');
  readonly resSortDir = signal<SortDir>('desc');

  readonly sortedResources = computed(() => {
    const key = this.resSortKey();
    const mul = this.resSortDir() === 'asc' ? 1 : -1;
    return [...this.resources].sort((a, b) => {
      const va = this.resValue(a, key);
      const vb = this.resValue(b, key);
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * mul;
      return ((va as number) - (vb as number)) * mul;
    });
  });

  private resValue(r: ResourceRow, key: ResourceSortKey): string | number {
    switch (key) {
      case 'name':        return r.name;
      case 'type':        return r.type;
      case 'uploaded':    return new Date(r.uploaded).getTime();
      case 'retrievals':  return r.retrievals;
      case 'utilization': return r.utilization;
      case 'negative':    return r.negative;
      case 'positive':    return r.positive;
    }
  }

  toggleResSort(key: ResourceSortKey) {
    if (this.resSortKey() === key) {
      this.resSortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.resSortKey.set(key);
      this.resSortDir.set(key === 'name' || key === 'type' ? 'asc' : 'desc');
    }
  }

  formatNum(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return n.toLocaleString();
  }

  // ----- Resource Details drawer (two views: resource | prompt) -----
  readonly drawerOpen = signal(false);
  readonly drawerView = signal<DrawerView>('resource');
  readonly drawerResource = signal<ResourceRow | null>(null);
  readonly drawerPrompt = signal<UserPrompt | null>(null);
  readonly drawerResourceId = computed(() => {
    const r = this.drawerResource();
    if (!r) return '';
    const seed = (r.name.charCodeAt(0) * 31 + r.name.length * 7).toString(16);
    return `col_${seed.padStart(8, '0').slice(0, 8)}`;
  });

  openResourceDrawer(r: ResourceRow) {
    this.drawerResource.set(r);
    this.drawerView.set('resource');
    this.drawerPrompt.set(null);
    this.drawerOpen.set(true);
  }
  openPromptDetail(p: UserPrompt) {
    this.drawerPrompt.set(p);
    this.drawerView.set('prompt');
  }
  backToResource() {
    this.drawerView.set('resource');
    this.drawerPrompt.set(null);
  }
  closeDrawer() {
    this.drawerOpen.set(false);
    // Defer state reset so the slide-out transition still shows content.
    setTimeout(() => {
      this.drawerView.set('resource');
      this.drawerPrompt.set(null);
      this.drawerResource.set(null);
    }, 280);
  }

  // Source occurrence + reliability mock derivations
  readonly drawerSourceOccurrence = computed(() => {
    const r = this.drawerResource();
    return r ? Math.max(1, Math.round(r.retrievals / 7)) : 0;
  });
  readonly drawerReliability = computed(() => {
    const r = this.drawerResource();
    return r ? +(r.utilization / 500).toFixed(2) : 0;
  });

  // User prompt types for the currently-open resource. Each row aggregates
  // every submission that shares the same intent against this resource —
  // positiveCount / negativeCount sum across all those submissions, and the
  // five-bucket breakdown matches the analysis page's drawer view.
  readonly resourcePrompts: UserPrompt[] = [
    {
      text: 'What financing mechanisms support flood resilience infrastructure?',
      negative: 21, positive: 79,
      positiveCount: 84, negativeCount: 22,
      negativeBreakdown: [
        { label: NEG_REASON_LABELS[0], count: 8 },
        { label: NEG_REASON_LABELS[1], count: 7 },
        { label: NEG_REASON_LABELS[2], count: 0 },
        { label: NEG_REASON_LABELS[3], count: 2 },
        { label: NEG_REASON_LABELS[4], count: 5 },
      ],
      otherComments: [
        'Did not reference the latest Country Economic Update.',
        'Wanted productivity figures from 2025, not 2022.',
        'Missed disaggregated sector data for the AFW region.',
      ],
    },
    {
      text: 'How can governments fund long-term climate resilience projects?',
      negative: 26, positive: 68,
      positiveCount: 54, negativeCount: 21,
      negativeBreakdown: [
        { label: NEG_REASON_LABELS[0], count: 6 },
        { label: NEG_REASON_LABELS[1], count: 8 },
        { label: NEG_REASON_LABELS[2], count: 0 },
        { label: NEG_REASON_LABELS[3], count: 2 },
        { label: NEG_REASON_LABELS[4], count: 5 },
      ],
      otherComments: [
        'Lacked comparable case studies from peer countries.',
        'No multi-year financing structures discussed.',
      ],
    },
    {
      text: 'What are effective investment models for urban drainage systems?',
      negative: 30, positive: 64,
      positiveCount: 38, negativeCount: 18,
      negativeBreakdown: [
        { label: NEG_REASON_LABELS[0], count: 5 },
        { label: NEG_REASON_LABELS[1], count: 7 },
        { label: NEG_REASON_LABELS[2], count: 0 },
        { label: NEG_REASON_LABELS[3], count: 1 },
        { label: NEG_REASON_LABELS[4], count: 5 },
      ],
      otherComments: [
        'Cost figures feel outdated.',
        'Wanted recent unit-cost benchmarks.',
      ],
    },
    {
      text: 'What PPP structures are commonly used for resilient water infrastructure?',
      negative: 24, positive: 70,
      positiveCount: 44, negativeCount: 15,
      negativeBreakdown: [
        { label: NEG_REASON_LABELS[0], count: 5 },
        { label: NEG_REASON_LABELS[1], count: 4 },
        { label: NEG_REASON_LABELS[2], count: 0 },
        { label: NEG_REASON_LABELS[3], count: 2 },
        { label: NEG_REASON_LABELS[4], count: 4 },
      ],
      otherComments: [
        'Missed concrete risk-allocation matrices.',
      ],
    },
    {
      text: 'How do countries finance disaster preparedness and flood recovery?',
      negative: 28, positive: 65,
      positiveCount: 32, negativeCount: 14,
      negativeBreakdown: [
        { label: NEG_REASON_LABELS[0], count: 4 },
        { label: NEG_REASON_LABELS[1], count: 5 },
        { label: NEG_REASON_LABELS[2], count: 0 },
        { label: NEG_REASON_LABELS[3], count: 2 },
        { label: NEG_REASON_LABELS[4], count: 3 },
      ],
      otherComments: [
        'Too focused on developed markets — wanted LMIC-specific examples.',
      ],
    },
    {
      text: 'What role do MDBs play in financing flood resilience projects?',
      negative: 25, positive: 70,
      positiveCount: 36, negativeCount: 13,
      negativeBreakdown: [
        { label: NEG_REASON_LABELS[0], count: 4 },
        { label: NEG_REASON_LABELS[1], count: 5 },
        { label: NEG_REASON_LABELS[2], count: 0 },
        { label: NEG_REASON_LABELS[3], count: 1 },
        { label: NEG_REASON_LABELS[4], count: 3 },
      ],
      otherComments: [
        'Wanted post-2024 MDB pledge data.',
      ],
    },
    {
      text: 'Which countries have successful flood resilience financing programs?',
      negative: 22, positive: 72,
      positiveCount: 28, negativeCount: 9,
      negativeBreakdown: [
        { label: NEG_REASON_LABELS[0], count: 3 },
        { label: NEG_REASON_LABELS[1], count: 3 },
        { label: NEG_REASON_LABELS[2], count: 0 },
        { label: NEG_REASON_LABELS[3], count: 1 },
        { label: NEG_REASON_LABELS[4], count: 2 },
      ],
      otherComments: [
        'Lacked evaluation outcomes — wanted impact evaluation summaries.',
      ],
    },
  ];

  readonly promptSortKey = signal<PromptSortKey>('negative');
  readonly promptSortDir = signal<SortDir>('desc');
  readonly sortedPrompts = computed(() => {
    const key = this.promptSortKey();
    const mul = this.promptSortDir() === 'asc' ? 1 : -1;
    return [...this.resourcePrompts].sort((a, b) => {
      if (key === 'name') return a.text.localeCompare(b.text) * mul;
      return ((a[key] as number) - (b[key] as number)) * mul;
    });
  });
  togglePromptSort(key: PromptSortKey) {
    if (this.promptSortKey() === key) {
      this.promptSortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.promptSortKey.set(key);
      this.promptSortDir.set(key === 'name' ? 'asc' : 'desc');
    }
  }

}

