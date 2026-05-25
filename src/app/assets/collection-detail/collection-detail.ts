import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';

type KptTab = 'knowledge' | 'people' | 'tasks';
type SortDir = 'asc' | 'desc';
type ResourceSortKey = 'name' | 'type' | 'uploaded' | 'retrievals' | 'utilization' | 'negative' | 'positive';
type PromptSortKey = 'name' | 'negative' | 'positive';
type DrawerView = 'resource' | 'prompt';

interface UserPrompt {
  text: string;
  negative: number;     // %
  positive: number;     // %
  feedbackUser: string;
  feedbackDate: string;
  promptBody: string;
  negativeReason: string;
  negativeTag: string;
  recommendation: string;
}

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
    owner:     'Global Water Practice',
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
      { label: 'Climate Adaptation Strategies',  pct: 24, prompts: 122 },
      { label: 'Water Infrastructure Financing', pct: 22, prompts: 112 },
      { label: 'Urban Resilience',               pct:  9, prompts:  46 },
      { label: 'Disaster Preparedness',          pct:  6, prompts:  30 },
    ],
    people: [
      { label: 'Water Resources Specialists',    pct: 48, prompts: 100 },
      { label: 'Climate Adaptation Leads',       pct: 28, prompts:  59 },
      { label: 'Hydrologists',                   pct: 12, prompts:  25 },
      { label: 'Urban Planners',                 pct:  7, prompts:  15 },
      { label: 'M&E Specialists',                pct:  5, prompts:  10 },
    ],
    tasks: [
      { label: 'TOR: Water Sector Diagnostic',   pct: 52, prompts:  66 },
      { label: 'Project Concept Notes',          pct: 22, prompts:  28 },
      { label: 'Synthesis: Drought Response',    pct: 14, prompts:  18 },
      { label: 'Briefs: Climate Adaptation',     pct:  7, prompts:   9 },
      { label: 'Slides: Resilience Outcomes',    pct:  5, prompts:   6 },
    ],
  };
  readonly activeCategories = computed(() => this.categoriesByTab[this.activeTab()]);

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
  readonly resources: ResourceRow[] = [
    { name: 'Flood Resilience Financing.pdf',  type: 'Framework', uploaded: '2026-05-14', uploadedDisplay: 'May 14, 2026', retrievals: 82, utilization: 95, negative: 6400, positive: 6400 },
    { name: 'Urban Drainage Strategy 2024.docx', type: 'Strategy', uploaded: '2026-05-12', uploadedDisplay: 'May 12, 2026', retrievals: 79, utilization: 35, negative: 5900, positive: 5900 },
    { name: 'Drought Resilience Case Studies',  type: 'Web Link',  uploaded: '2026-05-10', uploadedDisplay: 'May 10, 2026', retrievals: 74, utilization: 86, negative: 4800, positive: 4800 },
    { name: 'Digital Public Infrastructure Playbook', type: 'Playbook', uploaded: '2026-04-12', uploadedDisplay: 'Apr 12, 2026', retrievals: 88, utilization: 56, negative: 3000, positive: 3000 },
    { name: 'AI Readiness Country Assessments', type: 'Assessment', uploaded: '2026-04-06', uploadedDisplay: 'Apr 6, 2026',  retrievals: 71, utilization: 43, negative: 2900, positive: 2900 },
    { name: 'Health Systems Resilience Notes',  type: 'Notes',      uploaded: '2026-04-06', uploadedDisplay: 'Apr 6, 2026',  retrievals: 77, utilization: 93, negative: 2000, positive: 2000 },
    { name: 'Education Technology Deployment Cases', type: 'Case Studies', uploaded: '2026-04-04', uploadedDisplay: 'Apr 4, 2026', retrievals: 75, utilization: 82, negative: 1200, positive: 1200 },
    { name: 'Debt Sustainability Analysis Repository', type: 'Repository', uploaded: '2026-04-02', uploadedDisplay: 'Apr 2, 2026', retrievals: 84, utilization: 68, negative: 1100, positive: 1100 },
    { name: 'SME Growth and Jobs Repository',  type: 'Repository', uploaded: '2026-04-01', uploadedDisplay: 'Apr 1, 2026',  retrievals: 69, utilization: 52, negative: 1000, positive: 1000 },
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

  // User prompts for the currently-open resource (shared mock list)
  readonly resourcePrompts: UserPrompt[] = [
    { text: 'What financing mechanisms support flood resilience infrastructure?', negative: 72, positive: 72,
      feedbackUser: 'Hans Zimmer', feedbackDate: 'Jan 10, 2026',
      promptBody: 'No – There are applicable requirements.',
      negativeReason: 'Too focused on policy, not execution', negativeTag: 'Unclear',
      recommendation: 'User wanted operational guidance or project structuring detail' },
    { text: 'How can governments fund long-term climate resilience projects?', negative: 72, positive: 72,
      feedbackUser: 'Hans Zimmer', feedbackDate: 'Jan 9, 2026',
      promptBody: 'No – There are applicable requirements.',
      negativeReason: 'Lacks country-specific examples', negativeTag: 'Incomplete',
      recommendation: 'User wanted comparable case studies from peer countries' },
    { text: 'What are effective investment models for urban drainage systems?', negative: 72, positive: 72,
      feedbackUser: 'Hans Zimmer', feedbackDate: 'Jan 8, 2026',
      promptBody: 'No – There are applicable requirements.',
      negativeReason: 'Cost figures feel outdated', negativeTag: 'Outdated',
      recommendation: 'User wanted recent unit-cost benchmarks' },
    { text: 'What PPP structures are commonly used for resilient water infrastructure?', negative: 72, positive: 72,
      feedbackUser: 'Hans Zimmer', feedbackDate: 'Jan 7, 2026',
      promptBody: 'No – There are applicable requirements.',
      negativeReason: 'Misses risk-sharing details', negativeTag: 'Incomplete',
      recommendation: 'User wanted concrete risk-allocation matrices' },
    { text: 'How do countries finance disaster preparedness and flood recovery?', negative: 72, positive: 72,
      feedbackUser: 'Hans Zimmer', feedbackDate: 'Jan 6, 2026',
      promptBody: 'No – There are applicable requirements.',
      negativeReason: 'Too focused on developed markets', negativeTag: 'Unclear',
      recommendation: 'User wanted LMIC-specific examples' },
    { text: 'What role do MDBs play in financing flood resilience projects?', negative: 72, positive: 72,
      feedbackUser: 'Hans Zimmer', feedbackDate: 'Jan 5, 2026',
      promptBody: 'No – There are applicable requirements.',
      negativeReason: 'Missing recent commitments', negativeTag: 'Outdated',
      recommendation: 'User wanted post-2024 MDB pledge data' },
    { text: 'Which countries have successful flood resilience financing programs?', negative: 72, positive: 72,
      feedbackUser: 'Hans Zimmer', feedbackDate: 'Jan 4, 2026',
      promptBody: 'No – There are applicable requirements.',
      negativeReason: 'Lacks evaluation outcomes', negativeTag: 'Incomplete',
      recommendation: 'User wanted impact evaluation summaries' },
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

  copyPrompt() {
    const p = this.drawerPrompt();
    if (p) navigator.clipboard?.writeText(p.promptBody);
  }
}

