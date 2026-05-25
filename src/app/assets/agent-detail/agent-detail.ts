import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { toSlug } from '../../shared/slug';

type KptTab = 'knowledge' | 'people' | 'tasks';
type Workspace = 'wb' | 'ifc';
type SortDir = 'asc' | 'desc';
type CollectionSortKey = 'collection' | 'contribution';

interface KpiMetric { value: string; label?: string; delta?: string; }
interface AgentKpi {
  title: string;
  metrics: KpiMetric[];
  sub?: string;
  feedback?: { positive: number; negative: number };
}
interface SupportingCollection { name: string; contribution: number; }
interface PromptCategory { label: string; pct: number; prompts: number; }

interface AgentRecord {
  name: string;
  category: string;
  tagline: string;
  defaultTab: KptTab;
  kpis: AgentKpi[];
  collectionsByTab: Record<KptTab, SupportingCollection[]>;
  categoriesByTab: Record<KptTab, PromptCategory[]>;
}

// =============================================================================
// Per-agent data. Numbers anchored to K360 Master Data Extract (Power BI Tools):
//   Sherlock        — 6,992 PV · 2,164 visitors · 2 avg visits → ~4,328 sessions
//   TOR Genie       — 14,724 PV · 1,242 visitors · 3 avg visits → ~3,726 sessions
//   Lessons Explorer — 2,106 PV · 588 visitors · 2 avg visits → ~1,176 sessions
//   WBG Translate   — not in Power BI Tools sheet (illustrative only)
// =============================================================================
const AGENT_DATA: Record<string, AgentRecord> = {
  sherlock: {
    name: 'Sherlock – Expertise Detective',
    category: 'Knowledge Search',
    tagline: 'Find and connect with WBG colleagues by sector and country expertise.',
    defaultTab: 'people',
    kpis: [
      { title: 'Total Prompts',                metrics: [{ value: '6,992', delta: '+14%' }] },
      { title: 'Total Sessions',               metrics: [{ value: '4,328', delta: '+9%'  }] },
      { title: 'Feedback',                     metrics: [], feedback: { positive: 72, negative: 28 } },
      { title: 'Profile Click-through Rate',   metrics: [{ value: '24%', delta: '+3pp' }] },
    ],
    collectionsByTab: {
      knowledge: [
        { name: 'Staff Expertise Directory',  contribution: 22 },
        { name: 'Project Team Histories',     contribution: 18 },
        { name: 'Country Economic Updates',   contribution: 16 },
        { name: 'ICRR Archive',               contribution: 14 },
        { name: 'Communities of Practice',    contribution: 12 },
        { name: 'External Publications',      contribution: 10 },
      ],
      people: [
        { name: 'Staff Expertise Directory',   contribution: 32 },
        { name: 'Project Team Histories',      contribution: 22 },
        { name: 'Mission & BTOR Archives',     contribution: 18 },
        { name: 'Country Operations Metadata', contribution: 12 },
        { name: 'Communities of Practice',     contribution:  9 },
        { name: 'External Publications',       contribution:  7 },
      ],
      tasks: [
        { name: 'Project Concept Notes Archive', contribution: 28 },
        { name: 'Staff Expertise Directory',     contribution: 22 },
        { name: 'TOR Library',                   contribution: 18 },
        { name: 'Communities of Practice',       contribution: 14 },
        { name: 'Operations Policy Library',     contribution: 10 },
        { name: 'Mission & BTOR Archives',       contribution:  8 },
      ],
    },
    categoriesByTab: {
      knowledge: [
        { label: 'Sector Diagnostic Synthesis',   pct: 38, prompts: 41 },
        { label: 'Country Economic Briefings',    pct: 26, prompts: 28 },
        { label: 'Policy Note Generation',        pct: 18, prompts: 19 },
        { label: 'Evaluation Lessons Extraction', pct: 10, prompts: 11 },
        { label: 'Working Paper Summaries',       pct:  8, prompts:  9 },
      ],
      people: [
        { label: 'Peer Reviewer Discovery',  pct: 38, prompts: 78 },
        { label: 'Country Specialists',      pct: 26, prompts: 53 },
        { label: 'Sector SMEs',              pct: 18, prompts: 36 },
        { label: 'Mission Team Contacts',    pct: 10, prompts: 21 },
        { label: 'Cross-VPU Collaborators',  pct:  8, prompts: 16 },
      ],
      tasks: [
        { label: 'TOR Reviewer Lookup',          pct: 36, prompts: 18 },
        { label: 'Project Concept Reviewers',    pct: 24, prompts: 12 },
        { label: 'Procurement Specialists',      pct: 16, prompts:  8 },
        { label: 'Synthesis Co-Authors',         pct: 14, prompts:  7 },
        { label: 'Slide Deck Contributors',      pct: 10, prompts:  5 },
      ],
    },
  },

  'tor-genie': {
    name: 'TOR Genie',
    category: 'Document Generation',
    tagline: 'Find, adapt, and generate Terms of Reference from 140,000+ TORs.',
    defaultTab: 'tasks',
    kpis: [
      { title: 'Total Prompts',     metrics: [{ value: '14,724', delta: '+22%' }] },
      { title: 'Total Sessions',    metrics: [{ value: '3,726',  delta: '+18%' }] },
      { title: 'Feedback',          metrics: [], feedback: { positive: 65, negative: 30 } },
      { title: 'Download Rate',     metrics: [{ value: '12%', delta: '+2pp' }] },
    ],
    collectionsByTab: {
      knowledge: [
        { name: 'TOR Library',                   contribution: 28 },
        { name: 'Country Economic Updates',      contribution: 20 },
        { name: 'Project Concept Notes Archive', contribution: 18 },
        { name: 'Standard Specifications',       contribution: 14 },
        { name: 'Operations Policy Library',     contribution: 12 },
        { name: 'Macro Poverty Outlook',         contribution:  8 },
      ],
      people: [
        { name: 'Staff Expertise Directory',  contribution: 26 },
        { name: 'Project Team Histories',     contribution: 22 },
        { name: 'TOR Library',                contribution: 18 },
        { name: 'Mission & BTOR Archives',    contribution: 14 },
        { name: 'Communities of Practice',    contribution: 12 },
        { name: 'External Publications',      contribution:  8 },
      ],
      tasks: [
        { name: 'TOR Library',                    contribution: 38 },
        { name: 'TOR Genie Templates',            contribution: 22 },
        { name: 'Project Concept Notes Archive',  contribution: 14 },
        { name: 'Standard Specifications',        contribution: 12 },
        { name: 'Operations Policy Library',      contribution:  8 },
        { name: 'Procurement Notices Archive',    contribution:  6 },
      ],
    },
    categoriesByTab: {
      knowledge: [
        { label: 'TOR Scope Examples',          pct: 42, prompts: 38 },
        { label: 'Sector Reform Diagnostics',   pct: 24, prompts: 22 },
        { label: 'Country Sector Briefs',       pct: 16, prompts: 14 },
        { label: 'Standard Procurement Refs',   pct: 10, prompts:  9 },
        { label: 'Climate Scope Templates',     pct:  8, prompts:  7 },
      ],
      people: [
        { label: 'TOR Reviewer Lookup',         pct: 38, prompts: 32 },
        { label: 'Consultant Matching',         pct: 26, prompts: 22 },
        { label: 'Sector SMEs',                 pct: 18, prompts: 15 },
        { label: 'Procurement Specialists',     pct: 12, prompts: 10 },
        { label: 'Country Operations Leads',    pct:  6, prompts:  5 },
      ],
      tasks: [
        { label: 'Consulting Services TORs',    pct: 32, prompts: 84 },
        { label: 'Technical Design Supervision', pct: 22, prompts: 58 },
        { label: 'Sector Diagnostic TORs',      pct: 18, prompts: 48 },
        { label: 'Evaluation TORs',             pct: 14, prompts: 37 },
        { label: 'Procurement TORs',            pct: 14, prompts: 37 },
      ],
    },
  },

  'lessons-explorer': {
    name: 'Lessons Explorer',
    category: 'Knowledge Search',
    tagline: 'Distill insights from 8,000+ ICRRs and PPARs — successes and failures.',
    defaultTab: 'knowledge',
    kpis: [
      { title: 'Total Prompts',              metrics: [{ value: '2,106', delta: '+8%'  }] },
      { title: 'Total Sessions',             metrics: [{ value: '1,176', delta: '+6%'  }] },
      { title: 'Feedback',                   metrics: [], feedback: { positive: 78, negative: 22 } },
      { title: 'Intent Clarification Rate',  metrics: [{ value: '12%', delta: '−4pp' }] },
    ],
    collectionsByTab: {
      knowledge: [
        { name: 'ICRR Archive',                  contribution: 36 },
        { name: 'PPAR Database',                 contribution: 22 },
        { name: 'Performance and Learning Reviews', contribution: 16 },
        { name: 'Country Economic Updates',      contribution: 10 },
        { name: 'Macro Poverty Outlook',         contribution:  9 },
        { name: 'IEG Independent Review',        contribution:  7 },
      ],
      people: [
        { name: 'Staff Expertise Directory',  contribution: 28 },
        { name: 'Project Team Histories',     contribution: 24 },
        { name: 'Mission & BTOR Archives',    contribution: 16 },
        { name: 'ICRR Archive',               contribution: 14 },
        { name: 'Communities of Practice',    contribution: 10 },
        { name: 'External Publications',      contribution:  8 },
      ],
      tasks: [
        { name: 'ICRR Archive',                   contribution: 32 },
        { name: 'PPAR Database',                  contribution: 22 },
        { name: 'Project Concept Notes Archive',  contribution: 16 },
        { name: 'Operations Policy Library',      contribution: 12 },
        { name: 'TOR Library',                    contribution: 10 },
        { name: 'Knowledge Notes',                contribution:  8 },
      ],
    },
    categoriesByTab: {
      knowledge: [
        { label: 'Sector Lessons',          pct: 38, prompts: 64 },
        { label: 'Implementation Lessons',  pct: 26, prompts: 44 },
        { label: 'Project Design Lessons',  pct: 18, prompts: 30 },
        { label: 'Failed Operations',       pct: 10, prompts: 17 },
        { label: 'Regional Lessons',        pct:  8, prompts: 14 },
      ],
      people: [
        { label: 'Project Team Lookups',    pct: 36, prompts: 22 },
        { label: 'Sector Lead Discovery',   pct: 24, prompts: 15 },
        { label: 'TTL Discovery',           pct: 20, prompts: 12 },
        { label: 'Country Specialists',     pct: 12, prompts:  7 },
        { label: 'Cross-Sector Mentors',    pct:  8, prompts:  5 },
      ],
      tasks: [
        { label: 'Lessons Synthesis Drafts', pct: 42, prompts: 18 },
        { label: 'ICRR Briefings',           pct: 22, prompts: 10 },
        { label: 'Concept Note Lessons',     pct: 18, prompts:  8 },
        { label: 'Evaluation Inputs',        pct: 12, prompts:  5 },
        { label: 'Slide Deck Inputs',        pct:  6, prompts:  3 },
      ],
    },
  },

  'wbg-translate-tool': {
    name: 'WBG Translate Tool',
    category: 'Translation',
    tagline: 'Fast, reliable machine translation — including Official Use Only docs.',
    defaultTab: 'tasks',
    kpis: [
      { title: 'Total Prompts',  metrics: [{ value: '1,842', delta: '+11%' }] },
      { title: 'Total Sessions', metrics: [{ value: '892',   delta: '+9%'  }] },
      { title: 'Feedback',       metrics: [], feedback: { positive: 80, negative: 16 } },
      { title: 'Reuse Rate',     metrics: [{ value: '34%', delta: '+5pp' }] },
    ],
    collectionsByTab: {
      knowledge: [
        { name: 'Country Economic Updates',      contribution: 22 },
        { name: 'Policy Research Working Papers', contribution: 18 },
        { name: 'Macro Poverty Outlook',         contribution: 16 },
        { name: 'Knowledge Notes',               contribution: 14 },
        { name: 'External Publications',         contribution: 16 },
        { name: 'Other Collections',             contribution: 14 },
      ],
      people: [
        { name: 'Staff Expertise Directory',  contribution: 28 },
        { name: 'Communities of Practice',    contribution: 22 },
        { name: 'External Publications',      contribution: 18 },
        { name: 'Mission & BTOR Archives',    contribution: 14 },
        { name: 'Country Operations Metadata', contribution: 10 },
        { name: 'Project Team Histories',     contribution:  8 },
      ],
      tasks: [
        { name: 'TOR Library',                   contribution: 26 },
        { name: 'Project Concept Notes Archive', contribution: 22 },
        { name: 'Operations Policy Library',     contribution: 18 },
        { name: 'Standard Specifications',       contribution: 14 },
        { name: 'Knowledge Notes',               contribution: 12 },
        { name: 'External Publications',         contribution:  8 },
      ],
    },
    categoriesByTab: {
      knowledge: [
        { label: 'Working Paper Translation',  pct: 38, prompts: 42 },
        { label: 'Country Brief Translation',  pct: 24, prompts: 26 },
        { label: 'Policy Note Translation',    pct: 18, prompts: 20 },
        { label: 'Sector Diagnostic Excerpts', pct: 12, prompts: 14 },
        { label: 'External Pub. Translation',  pct:  8, prompts:  9 },
      ],
      people: [
        { label: 'Mission Notes Translation', pct: 42, prompts: 26 },
        { label: 'Expert Profile Excerpts',   pct: 22, prompts: 14 },
        { label: 'Communications Drafts',     pct: 18, prompts: 11 },
        { label: 'CoP Discussion Threads',    pct: 10, prompts:  6 },
        { label: 'External Bio Translation',  pct:  8, prompts:  5 },
      ],
      tasks: [
        { label: 'TOR Translation',           pct: 38, prompts: 54 },
        { label: 'Concept Note Translation',  pct: 24, prompts: 34 },
        { label: 'Procurement Translation',   pct: 18, prompts: 26 },
        { label: 'Policy Doc Translation',    pct: 12, prompts: 17 },
        { label: 'Slide Translation',         pct:  8, prompts: 11 },
      ],
    },
  },
};

// Map all known incoming slugs to the canonical data record. Multiple slug
// variants (short codes from the Assets canvas + the kebab-case slug of the
// agent's display name) all resolve to the same agent record.
const SLUG_TO_AGENT: Record<string, string> = {
  // Sherlock variants
  'sherlock':                       'sherlock',
  'sherlock-expertise-detective':   'sherlock',
  'sher':                           'sherlock',
  // TOR Genie variants
  'tor-genie': 'tor-genie',
  'tor':       'tor-genie',
  // Lessons Explorer variants
  'lessons-explorer': 'lessons-explorer',
  'less':             'lessons-explorer',
  // WBG Translate variants
  'wbg-translate-tool': 'wbg-translate-tool',
  'translate':          'wbg-translate-tool',
  'wbg':                'wbg-translate-tool',
};

@Component({
  selector: 'app-agent-detail',
  imports: [TablerIconComponent, RouterLink],
  templateUrl: './agent-detail.html',
  styleUrl: './agent-detail.css',
})
export class AgentDetail {
  private readonly route = inject(ActivatedRoute);

  readonly slug = signal<string>(this.route.snapshot.paramMap.get('slug') ?? 'sherlock');

  /** Resolve to the canonical agent record — falls back to Sherlock. */
  readonly agent = computed<AgentRecord>(() => {
    const key = SLUG_TO_AGENT[this.slug()] ?? 'sherlock';
    return AGENT_DATA[key] ?? AGENT_DATA['sherlock'];
  });

  readonly name = computed(() => this.agent().name);
  readonly tagline = computed(() => this.agent().tagline);
  readonly category = computed(() => this.agent().category);

  readonly kpis = computed(() => this.agent().kpis);
  readonly collectionsByTab = computed(() => this.agent().collectionsByTab);
  readonly categoriesByTab  = computed(() => this.agent().categoriesByTab);

  readonly workspace = signal<Workspace>('wb');
  setWorkspace(w: Workspace) { this.workspace.set(w); }

  /** Generate a URL slug for collection detail links. */
  slugFor(name: string): string { return toSlug(name); }

  // ----- Tabs -----
  readonly activeTab = signal<KptTab>('people');
  readonly tabDefs: { id: KptTab; label: string }[] = [
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'people',    label: 'People' },
    { id: 'tasks',     label: 'Tasks' },
  ];

  constructor() {
    // Default to the agent's natural tab (e.g. TOR Genie → Tasks).
    this.activeTab.set(this.agent().defaultTab);
  }

  readonly activeCategories  = computed(() => this.categoriesByTab()[this.activeTab()]);
  readonly activeCollections = computed(() => this.collectionsByTab()[this.activeTab()]);

  // ----- Collections table sort -----
  readonly colSortKey = signal<CollectionSortKey>('contribution');
  readonly colSortDir = signal<SortDir>('desc');
  readonly sortedCollections = computed(() => {
    const key = this.colSortKey();
    const mul = this.colSortDir() === 'asc' ? 1 : -1;
    return [...this.activeCollections()].sort((a, b) => {
      if (key === 'collection') return a.name.localeCompare(b.name) * mul;
      return (a.contribution - b.contribution) * mul;
    });
  });
  toggleColSort(key: CollectionSortKey) {
    if (this.colSortKey() === key) {
      this.colSortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.colSortKey.set(key);
      this.colSortDir.set(key === 'collection' ? 'asc' : 'desc');
    }
  }

  collectionsTitle = computed(() => {
    switch (this.activeTab()) {
      case 'knowledge': return 'Collections Supporting Knowledge';
      case 'people':    return 'Collections Supporting People';
      case 'tasks':     return 'Collections Supporting Tasks';
    }
  });
}
