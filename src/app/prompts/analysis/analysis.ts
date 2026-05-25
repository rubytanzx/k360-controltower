import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TablerIconComponent } from '@tabler/icons-angular';
import { DateRangeFilter } from '../../shared/date-range-filter/date-range-filter';
import { HierFilter } from '../../shared/hier-filter/hier-filter';
import {
  REGION_GROUPS, regionCountrySelectionFromParams,
} from '../../shared/hier-filter/hier-filter-catalog';
import { toSlug } from '../../shared/slug';

type KptDomain = 'knowledge' | 'people' | 'tasks';
type TopicId =
  | 'eg' | 'ml' | 'cli' | 'les' | 'hf' | 'oth' | 'exp'
  | 'peer' | 'cel' | 'tor' | 'syn' | 'doc'
  | 'cli-adapt' | 'water-infra' | 'agri-resil';

type MapMode = 'region' | 'country';

interface CollectionLink {
  name: string;
  contributionPct: number;
}

interface AgentUsage {
  name: string;
  usagePct: number;
}

interface NegativeDriver {
  title: string;
  reports: number;
  sharePct: number;  // share of all negatives
}

interface Subcategory {
  name: string;
  queries: number;
  repeatRate: number;        // 0..100
  retrievalSuccess: number;  // 0..100
  negativePct: number;       // 0..100
  positivePct: number;       // 0..100
}

/** One entry in the negative-feedback reason breakdown. The five standard
 *  reasons appear in this fixed order in every prompt: instructions, factual,
 *  offensive, language, other. */
interface NegReasonCount { label: string; count: number; }

interface SubcatPrompt {
  query: string;
  queries: number;        // distinct queries grouped under this prompt type
  negativePct: number;
  positivePct: number;
  // Aggregated feedback across every submission of this prompt type.
  positiveCount: number;
  negativeCount: number;
  /** Fixed length 5, ordered: instructions, factual, offensive, language, other. */
  negativeBreakdown: NegReasonCount[];
  /** Free-text comments captured when a user picked "Other" as the reason. */
  otherComments: string[];
}

/** Standard reason labels shown in the drawer breakdown. */
const NEG_REASON_LABELS = [
  'Did not Follow Instructions',
  'Not Factually Correct',
  'Offensive/Unsafe',
  'Wrong Language',
  'Other',
] as const;

interface SubcatDrawerData {
  name: string;
  /** AI insight paragraph — HTML allowed (<strong> for bold keywords). */
  aiInsightHtml: string;
  topVpus: string[];
  topCollections: string[];
  prompts: SubcatPrompt[];
}

interface CategoryData {
  id: TopicId;
  domain: KptDomain;
  name: string;
  updatedAgo: string;

  // ----- KPI titles vary by domain. For Knowledge → "Total No. of Prompts" +
  // "Intent Clarification Rate" + "Repeat Query Rate". For People → "Total
  // Searches" + "Profile Click-through Rate" + "Repeat Search Rate". For
  // Tasks → "Total Generations" + "Download Rate" + "Repeat Generation Rate".
  primaryTitle: string;
  primaryCount: number;
  primaryDeltaPct: number;

  totalFeedback: number;
  positivePct: number;
  negativePct: number;

  conversionTitle: string;
  conversionPct: number;
  conversionDeltaPct: number;
  conversionCompare: string;

  repeatTitle: string;
  repeatPct: number;
  repeatDeltaPct: number;

  collections: CollectionLink[];
  agents: AgentUsage[];
  negativeDrivers: NegativeDriver[];
  subcategories: Subcategory[];
  // Subcategory table column labels — also varies by domain.
  subcatCountLabel: string;     // 'No. of Queries' | 'No. of Searches' | 'No. of Generations'
  subcatRepeatLabel: string;    // 'Repeat Rate'
  subcatConversionLabel: string;// 'Retrieval Success' | 'Profile Click-through' | 'Download Rate'

  mapIntensity: Record<string, number>;
  regionQueries: Record<string, number>;
  countryQueries: Record<string, number>;
}

@Component({
  selector: 'app-prompts-analysis',
  imports: [TablerIconComponent, RouterLink, DateRangeFilter, HierFilter],
  templateUrl: './analysis.html',
  styleUrl: './analysis.css',
})
export class Analysis {
  // ---- Shared filter catalog (Region/Country) ----
  readonly regionGroups = REGION_GROUPS;

  /** Pre-applied Region/Country from the URL — used both to seed the
   *  HierFilter on entry and to forward as query params when clicking
   *  through to a collection or agent detail page. */
  readonly initialRegionCountry = (() => {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    return regionCountrySelectionFromParams({ region: q.get('region'), country: q.get('country') });
  })();

  /** Current Region/Country selection — starts with whatever was passed in
   *  the URL and tracks user changes via (selectionChange). Used to build
   *  query params on outbound collection/agent row links. */
  readonly currentRegionCountry = signal<string[]>(this.initialRegionCountry);

  /** Query params for outbound links — collapses fully-selected regions back
   *  into a single `?region=…` for cleaner URLs; otherwise emits country ids
   *  as a comma-separated `?country=…` list. Returns `{}` when nothing is
   *  selected so the resulting link has no extra noise. */
  readonly outboundRegionParams = computed<Record<string, string>>(() => {
    const sel = new Set(this.currentRegionCountry());
    const out: Record<string, string> = {};
    if (sel.size === 0) return out;
    // If the whole catalogue matches a single fully-selected region group,
    // collapse it to `?region=<code>`.
    for (const g of REGION_GROUPS) {
      const allChildren = g.children.map(c => c.id);
      const isExactMatch = allChildren.length === sel.size
        && allChildren.every(id => sel.has(id));
      if (isExactMatch) { out['region'] = g.id; return out; }
    }
    out['country'] = sel.size === 1 ? [...sel][0] : [...sel].join(',');
    return out;
  });

  // ============ Category data ============
  private readonly categories: Record<TopicId, CategoryData> = {
    eg: {
      id: 'eg',
      domain: 'knowledge',
      // Reference: Adobe Analytics #1 prompt was "What are the main challenges
      // facing Ghana's economic growth and productivity?" (56 occurrences).
      // Subcategory totals below sum to 179 — matches primaryCount exactly.
      name: 'Macroeconomic Research',
      updatedAgo: '2 hours ago',
      primaryTitle: 'Total No. of Prompts',
      primaryCount: 179, primaryDeltaPct: 12,
      // 70% of prompts get explicit feedback (positive or negative). 268 events.
      totalFeedback: 268, positivePct: 72, negativePct: 28,
      conversionTitle: 'Intent Clarification Rate',
      conversionPct: 14, conversionDeltaPct: 3, conversionCompare: 'compared to 50.54% platform average',
      repeatTitle: 'Repeat Query Rate',
      repeatPct: 70, repeatDeltaPct: 3,
      subcatCountLabel: 'No. of Queries',
      subcatRepeatLabel: 'Repeat Rate',
      subcatConversionLabel: 'Retrieval Success',
      // Real K360 featured collections (Master Data Extract).
      collections: [
        { name: 'Country Growth and Jobs',     contributionPct: 24 },
        { name: 'Fiscal Policy and Growth',    contributionPct: 18 },
        { name: 'Macro Poverty Outlook',       contributionPct: 14 },
        { name: 'Debt Sustainability Analysis', contributionPct: 12 },
        { name: 'Country Economic Updates',    contributionPct: 11 },
        { name: 'Public Finance Review',       contributionPct: 11 },
        { name: 'Other Collections',           contributionPct: 10 },
      ],
      // Real K360 agent names. Knowledge-search agents dominate for an
      // analytical economic-growth topic.
      agents: [
        { name: 'Lessons Explorer',                           usagePct: 34 },
        { name: 'Sherlock – Expertise Detective',             usagePct: 26 },
        { name: 'Self-Service Portfolio Analysis (SSPA)',     usagePct: 18 },
        { name: 'Literature Review and Policy Paper Generator', usagePct: 14 },
        { name: 'ISR Issues Explorer',                        usagePct:  8 },
      ],
      // Sums to 100%. Reports = sharePct × (totalFeedback × negativePct/100) ≈ 75 events.
      negativeDrivers: [
        { title: 'Outdated references',             reports: 24, sharePct: 32 },
        { title: 'Misguiding',                      reports: 18, sharePct: 24 },
        { title: 'Incomplete Climate Case Studies', reports: 14, sharePct: 18 },
        { title: 'Not factually correct',           reports: 12, sharePct: 16 },
        { title: 'Wrong Language',                  reports:  7, sharePct: 10 },
      ],
      // Queries sum to 179 (matches totalPrompts). Macroeconomic Stability
      // matches the prompts shown in the subcategory drawer (sum = 53).
      // Positive + negative ≤ 100 (rest = no explicit feedback).
      subcategories: [
        { name: 'Macroeconomic Stability',             queries: 53, repeatRate: 68, retrievalSuccess: 82, negativePct: 14, positivePct: 72 },
        { name: 'Debt & Fiscal Sustainability',        queries: 19, repeatRate: 72, retrievalSuccess: 79, negativePct: 18, positivePct: 68 },
        { name: 'Private Sector & Investment Climate', queries: 18, repeatRate: 45, retrievalSuccess: 74, negativePct: 22, positivePct: 65 },
        { name: 'Jobs & Productivity',                 queries: 17, repeatRate: 57, retrievalSuccess: 88, negativePct: 10, positivePct: 78 },
        { name: 'Agriculture & Rural Transformation',  queries: 17, repeatRate: 40, retrievalSuccess: 71, negativePct: 16, positivePct: 70 },
        { name: 'Energy & Infrastructure',             queries: 14, repeatRate: 20, retrievalSuccess: 77, negativePct: 25, positivePct: 62 },
        { name: 'Industrialization & Manufacturing',   queries: 13, repeatRate: 20, retrievalSuccess: 75, negativePct: 12, positivePct: 75 },
        { name: 'Digital Economy & Innovation',        queries: 12, repeatRate: 20, retrievalSuccess: 84, negativePct:  8, positivePct: 80 },
        { name: 'Governance & Institutional Capacity', queries:  8, repeatRate: 14, retrievalSuccess: 69, negativePct: 18, positivePct: 70 },
        { name: 'Trade & Regional Integration',        queries:  8, repeatRate: 10, retrievalSuccess: 69, negativePct: 14, positivePct: 73 },
      ],
      // Intensity heat-map for Ghana topic — concentrated across AFW (Ghana,
      // Nigeria, Senegal) and SAR (India) plus East Africa benchmarks.
      mapIntensity: {
        gh: 6, ng: 5, sn: 4, ci: 4, ke: 5, tz: 4, et: 4, za: 5,
        in: 6, bd: 5, pk: 4, lk: 3,
        cn: 3, id: 3, vn: 3,
        br: 3, mx: 3,
      },
      // Region totals = 254 (~ 179 prompts × 1.4 region touches/prompt — some
      // prompts compare across multiple regions). Country queries match the
      // top countries in Power BI for Ghana-related searches.
      regionQueries:  { afe: 38,  afw: 105, eap: 22, eca: 14, lac: 18, mna: 12, sar: 45 },
      countryQueries: { gh: 78, ng: 28, sn: 18, ci: 12, ke: 22, tz: 15, et: 12, za: 14, in: 24, bd: 8, pk: 6, lk: 4, cn: 7, id: 6, vn: 4, br: 5, mx: 4 },
    },
    // ===================== People domain — Expertise Search =====================
    // Real Adobe actions: "Expert Twin – Click – Chat Page" (30),
    // "Interact Click – Expert Twin Click" (84), "Viewed Expert Profile".
    exp: {
      id: 'exp',
      domain: 'people',
      name: 'Expert & People Discovery',
      updatedAgo: '2 hours ago',
      primaryTitle: 'Total Searches',
      primaryCount: 64, primaryDeltaPct: 8,
      totalFeedback: 38, positivePct: 68, negativePct: 24,
      // 84 expert profile clicks across ~350 searches platform-wide ≈ 24%;
      // for this energy-sector slice we expect a similar rate.
      conversionTitle: 'Profile Click-through Rate',
      conversionPct: 28, conversionDeltaPct: -4, conversionCompare: '84 expert clicks across 64 searches',
      repeatTitle: 'Repeat Search Rate',
      repeatPct: 45, repeatDeltaPct: 6,
      subcatCountLabel: 'No. of Searches',
      subcatRepeatLabel: 'Repeat Rate',
      subcatConversionLabel: 'Profile Click-through',
      collections: [
        { name: 'Staff Expertise Directory',  contributionPct: 32 },
        { name: 'Project Team Histories',     contributionPct: 22 },
        { name: 'Mission & BTOR Archives',    contributionPct: 18 },
        { name: 'Communities of Practice',    contributionPct: 14 },
        { name: 'External Publications',      contributionPct:  9 },
        { name: 'Other Collections',          contributionPct:  5 },
      ],
      agents: [
        { name: 'Sherlock – Expertise Detective',             usagePct: 78 },
        { name: 'Lessons Explorer',                           usagePct:  9 },
        { name: 'Self-Service Portfolio Analysis (SSPA)',     usagePct:  6 },
        { name: 'Literature Review and Policy Paper Generator', usagePct: 4 },
        { name: 'ISR Issues Explorer',                        usagePct:  3 },
      ],
      negativeDrivers: [
        { title: 'Expert profile not found',  reports: 4, sharePct: 38 },
        { title: 'Outdated expertise tagging', reports: 3, sharePct: 28 },
        { title: 'Missing contact info',      reports: 2, sharePct: 18 },
        { title: 'Wrong sector match',        reports: 1, sharePct: 10 },
        { title: 'Profile too sparse',        reports: 1, sharePct:  6 },
      ],
      subcategories: [
        { name: 'Renewable Energy Specialists',  queries: 18, repeatRate: 42, retrievalSuccess: 78, negativePct: 18, positivePct: 70 },
        { name: 'Power Sector Specialists',      queries: 14, repeatRate: 50, retrievalSuccess: 72, negativePct: 24, positivePct: 64 },
        { name: 'Energy Policy Leads',           queries: 11, repeatRate: 38, retrievalSuccess: 68, negativePct: 22, positivePct: 66 },
        { name: 'Grid & Transmission Engineers', queries:  8, repeatRate: 44, retrievalSuccess: 80, negativePct: 16, positivePct: 72 },
        { name: 'Mining & Extractives Experts',  queries:  7, repeatRate: 32, retrievalSuccess: 65, negativePct: 28, positivePct: 60 },
        { name: 'Climate Finance Advisors',      queries:  6, repeatRate: 28, retrievalSuccess: 70, negativePct: 20, positivePct: 68 },
      ],
      mapIntensity: { ke: 5, tz: 4, et: 3, ng: 5, sn: 3, gh: 4, in: 6, pk: 4, br: 3, mx: 3, id: 4 },
      regionQueries:  { afe: 14, afw: 12, eap: 10, eca: 6, lac: 8, mna: 5, sar: 9 },
      countryQueries: { ke: 8, ng: 6, gh: 4, in: 9, br: 3, mx: 3, id: 4, sn: 3, et: 2 },
    },

    // ===================== Tasks domain — TOR Generation =====================
    // Real Adobe actions: "Download TORs", "Download Summary", "Download PPT".
    // TOR Genie tops Power BI tools at 14,724 page views (62% of tool actions).
    tor: {
      id: 'tor',
      domain: 'tasks',
      name: 'Document & TOR Generation',
      updatedAgo: '2 hours ago',
      primaryTitle: 'Total Generations',
      primaryCount: 142, primaryDeltaPct: 18,
      totalFeedback: 86, positivePct: 65, negativePct: 30,
      // "Outputs downloaded" — only 8% of generated TORs were downloaded.
      conversionTitle: 'Download Rate',
      conversionPct: 8, conversionDeltaPct: -6, conversionCompare: 'compared to 18% platform average',
      repeatTitle: 'Repeat Generation Rate',
      repeatPct: 32, repeatDeltaPct: 4,
      subcatCountLabel: 'No. of Generations',
      subcatRepeatLabel: 'Repeat Rate',
      subcatConversionLabel: 'Download Rate',
      collections: [
        { name: 'TOR Library',                  contributionPct: 36 },
        { name: 'TOR Genie Templates',          contributionPct: 22 },
        { name: 'Project Concept Notes Archive', contributionPct: 16 },
        { name: 'Standard Specifications',      contributionPct: 12 },
        { name: 'Operations Policy Library',    contributionPct:  8 },
        { name: 'Other Collections',            contributionPct:  6 },
      ],
      agents: [
        { name: 'TOR Genie',                                  usagePct: 82 },
        { name: 'Grumpy Reviewer',                            usagePct:  8 },
        { name: 'Literature Review and Policy Paper Generator', usagePct: 4 },
        { name: 'Self-Service Portfolio Analysis (SSPA)',     usagePct:  3 },
        { name: 'WBG Translate Tool',                         usagePct:  3 },
      ],
      negativeDrivers: [
        { title: 'Wrong template type',          reports: 9, sharePct: 35 },
        { title: 'Missing climate scope',        reports: 7, sharePct: 27 },
        { title: 'Format mismatch',              reports: 4, sharePct: 16 },
        { title: 'Outdated procurement language', reports: 3, sharePct: 12 },
        { title: 'Too generic',                  reports: 3, sharePct: 10 },
      ],
      subcategories: [
        { name: 'Climate Adaptation Consulting TORs',    queries: 38, repeatRate: 34, retrievalSuccess:  9, negativePct: 28, positivePct: 60 },
        { name: 'Renewable Energy Project TORs',          queries: 26, repeatRate: 30, retrievalSuccess: 12, negativePct: 24, positivePct: 64 },
        { name: 'Climate Risk Assessment TORs',           queries: 22, repeatRate: 32, retrievalSuccess:  7, negativePct: 32, positivePct: 58 },
        { name: 'Resilience Infrastructure Supervision',  queries: 18, repeatRate: 28, retrievalSuccess:  8, negativePct: 26, positivePct: 62 },
        { name: 'Climate Finance Diagnostic TORs',        queries: 16, repeatRate: 38, retrievalSuccess:  6, negativePct: 35, positivePct: 55 },
        { name: 'Evaluation TORs',                        queries: 12, repeatRate: 26, retrievalSuccess: 10, negativePct: 22, positivePct: 66 },
        { name: 'Transport Decarbonization TORs',         queries: 10, repeatRate: 30, retrievalSuccess:  7, negativePct: 30, positivePct: 60 },
      ],
      mapIntensity: { ke: 4, ng: 4, gh: 3, in: 5, id: 5, vn: 4, br: 4, mx: 3, pl: 3 },
      regionQueries:  { afe: 24, afw: 22, eap: 30, eca: 16, lac: 18, mna: 12, sar: 20 },
      countryQueries: { ke: 12, ng: 10, gh: 6, in: 18, id: 14, vn: 10, br: 9, mx: 7, pl: 5 },
    },

    // ===================== Knowledge — Climate Adaptation & Resilience =====================
    // Kenya-anchored climate adaptation topic. Subcategory totals = 142 prompts
    // (matches primaryCount). AFE-weighted intensity reflects East-African
    // demand seen in the Adobe drill-down for Kenya climate queries.
    'cli-adapt': {
      id: 'cli-adapt',
      domain: 'knowledge',
      name: 'Climate Adaptation & Resilience',
      updatedAgo: '3 hours ago',
      primaryTitle: 'Total No. of Prompts',
      primaryCount: 142, primaryDeltaPct: 18,
      totalFeedback: 214, positivePct: 74, negativePct: 22,
      conversionTitle: 'Intent Clarification Rate',
      conversionPct: 18, conversionDeltaPct: 4, conversionCompare: 'compared to 50.54% platform average',
      repeatTitle: 'Repeat Query Rate',
      repeatPct: 64, repeatDeltaPct: 5,
      subcatCountLabel: 'No. of Queries',
      subcatRepeatLabel: 'Repeat Rate',
      subcatConversionLabel: 'Retrieval Success',
      collections: [
        { name: 'Climate Adaptation Toolkit',           contributionPct: 28 },
        { name: 'Climate Adaptation Financing Framework', contributionPct: 22 },
        { name: 'Country Climate and Development Reports', contributionPct: 16 },
        { name: 'Resilient Infrastructure Library',     contributionPct: 12 },
        { name: 'NDC Implementation Notes',             contributionPct: 11 },
        { name: 'Other Collections',                    contributionPct: 11 },
      ],
      agents: [
        { name: 'Lessons Explorer',                           usagePct: 32 },
        { name: 'Literature Review and Policy Paper Generator', usagePct: 24 },
        { name: 'Self-Service Portfolio Analysis (SSPA)',     usagePct: 18 },
        { name: 'Sherlock – Expertise Detective',             usagePct: 16 },
        { name: 'ISR Issues Explorer',                        usagePct: 10 },
      ],
      negativeDrivers: [
        { title: 'Outdated case studies',          reports: 15, sharePct: 32 },
        { title: 'Missing local context',          reports: 11, sharePct: 24 },
        { title: 'Generic recommendations',        reports:  8, sharePct: 18 },
        { title: 'Cost figures not localized',     reports:  6, sharePct: 14 },
        { title: 'Wrong sector framing',           reports:  5, sharePct: 12 },
      ],
      subcategories: [
        { name: 'Drought Resilience Planning',         queries: 38, repeatRate: 64, retrievalSuccess: 80, negativePct: 18, positivePct: 72 },
        { name: 'Coastal & Flood Risk Management',     queries: 26, repeatRate: 58, retrievalSuccess: 76, negativePct: 22, positivePct: 68 },
        { name: 'Adaptation Finance Instruments',      queries: 22, repeatRate: 70, retrievalSuccess: 72, negativePct: 24, positivePct: 66 },
        { name: 'Climate-Smart Urban Planning',        queries: 18, repeatRate: 48, retrievalSuccess: 78, negativePct: 16, positivePct: 74 },
        { name: 'Ecosystem-Based Adaptation',          queries: 16, repeatRate: 42, retrievalSuccess: 74, negativePct: 20, positivePct: 70 },
        { name: 'Early Warning Systems',               queries: 12, repeatRate: 36, retrievalSuccess: 82, negativePct: 14, positivePct: 76 },
        { name: 'NDC & National Adaptation Plans',     queries: 10, repeatRate: 30, retrievalSuccess: 70, negativePct: 22, positivePct: 68 },
      ],
      mapIntensity: {
        ke: 6, tz: 5, et: 4, ug: 4, rw: 3, mz: 4, za: 4,
        ng: 4, sn: 3, gh: 3, ci: 3,
        bd: 5, in: 5, pk: 4, lk: 3, np: 3,
        vn: 4, id: 4, ph: 3,
        br: 3, mx: 3,
      },
      regionQueries:  { afe: 96, afw: 38, eap: 32, eca: 10, lac: 18, mna: 12, sar: 48 },
      countryQueries: { ke: 44, tz: 18, et: 12, ug: 10, rw:  6, mz:  8, za: 12, ng: 14, sn:  6, gh:  8, ci:  6, in: 18, bd: 14, pk:  8, lk:  4, vn:  8, id:  8, ph:  4, br:  6, mx:  4 },
    },

    // ===================== Knowledge — Water & Infrastructure ===================
    // Subcategory totals = 118 prompts (matches primaryCount).
    'water-infra': {
      id: 'water-infra',
      domain: 'knowledge',
      name: 'Water & Infrastructure',
      updatedAgo: '4 hours ago',
      primaryTitle: 'Total No. of Prompts',
      primaryCount: 118, primaryDeltaPct: 9,
      totalFeedback: 176, positivePct: 70, negativePct: 26,
      conversionTitle: 'Intent Clarification Rate',
      conversionPct: 16, conversionDeltaPct: 2, conversionCompare: 'compared to 50.54% platform average',
      repeatTitle: 'Repeat Query Rate',
      repeatPct: 58, repeatDeltaPct: 2,
      subcatCountLabel: 'No. of Queries',
      subcatRepeatLabel: 'Repeat Rate',
      subcatConversionLabel: 'Retrieval Success',
      collections: [
        { name: 'Water Policy Notes',                    contributionPct: 26 },
        { name: 'Urban Water & Sanitation Library',      contributionPct: 22 },
        { name: 'Resilient Infrastructure Library',      contributionPct: 16 },
        { name: 'Water Sector PPP Toolkit',              contributionPct: 14 },
        { name: 'Country Climate and Development Reports', contributionPct: 12 },
        { name: 'Other Collections',                     contributionPct: 10 },
      ],
      agents: [
        { name: 'Self-Service Portfolio Analysis (SSPA)',     usagePct: 30 },
        { name: 'Lessons Explorer',                           usagePct: 26 },
        { name: 'Literature Review and Policy Paper Generator', usagePct: 18 },
        { name: 'Sherlock – Expertise Detective',             usagePct: 16 },
        { name: 'ISR Issues Explorer',                        usagePct: 10 },
      ],
      negativeDrivers: [
        { title: 'Cost benchmarks not localized',  reports: 13, sharePct: 30 },
        { title: 'Missing tariff data',            reports: 10, sharePct: 22 },
        { title: 'Outdated project references',    reports:  8, sharePct: 18 },
        { title: 'Generic O&M guidance',           reports:  7, sharePct: 16 },
        { title: 'Incomplete safeguards detail',   reports:  6, sharePct: 14 },
      ],
      subcategories: [
        { name: 'Urban Water Supply',                  queries: 32, repeatRate: 58, retrievalSuccess: 76, negativePct: 22, positivePct: 70 },
        { name: 'Sanitation & Wastewater',             queries: 24, repeatRate: 50, retrievalSuccess: 74, negativePct: 24, positivePct: 68 },
        { name: 'Irrigation & Agricultural Water',     queries: 18, repeatRate: 46, retrievalSuccess: 70, negativePct: 26, positivePct: 66 },
        { name: 'Water Storage & Dams',                queries: 14, repeatRate: 38, retrievalSuccess: 68, negativePct: 28, positivePct: 64 },
        { name: 'Rural Water & WASH',                  queries: 12, repeatRate: 34, retrievalSuccess: 72, negativePct: 20, positivePct: 72 },
        { name: 'Water Sector PPPs & Financing',       queries: 10, repeatRate: 44, retrievalSuccess: 66, negativePct: 30, positivePct: 60 },
        { name: 'Non-Revenue Water Reduction',         queries:  8, repeatRate: 28, retrievalSuccess: 78, negativePct: 18, positivePct: 74 },
      ],
      mapIntensity: {
        ke: 6, tz: 5, et: 5, ug: 4, rw: 3, za: 4, mz: 3,
        ng: 4, sn: 3, ci: 3,
        in: 6, bd: 5, pk: 5, lk: 3, np: 3,
        eg: 5, ma: 3, jo: 3,
        id: 4, vn: 3,
      },
      regionQueries:  { afe: 78, afw: 28, eap: 22, eca:  8, lac: 12, mna: 26, sar: 46 },
      countryQueries: { ke: 36, tz: 14, et: 12, ug:  8, rw:  4, za:  8, mz:  6, ng: 12, sn:  6, ci:  4, in: 20, bd: 12, pk: 10, lk:  4, eg: 12, ma:  6, jo:  4, id:  8, vn:  4 },
    },

    // ===================== Knowledge — Agricultural Resilience =================
    // Subcategory totals = 96 prompts (matches primaryCount).
    'agri-resil': {
      id: 'agri-resil',
      domain: 'knowledge',
      name: 'Agricultural Resilience',
      updatedAgo: '5 hours ago',
      primaryTitle: 'Total No. of Prompts',
      primaryCount: 96, primaryDeltaPct: 14,
      totalFeedback: 142, positivePct: 71, negativePct: 25,
      conversionTitle: 'Intent Clarification Rate',
      conversionPct: 17, conversionDeltaPct: 3, conversionCompare: 'compared to 50.54% platform average',
      repeatTitle: 'Repeat Query Rate',
      repeatPct: 60, repeatDeltaPct: 4,
      subcatCountLabel: 'No. of Queries',
      subcatRepeatLabel: 'Repeat Rate',
      subcatConversionLabel: 'Retrieval Success',
      collections: [
        { name: 'Climate-Smart Agriculture Library',    contributionPct: 28 },
        { name: 'Food Systems & Nutrition Notes',       contributionPct: 20 },
        { name: 'Agricultural Productivity Reports',    contributionPct: 16 },
        { name: 'Climate Adaptation Toolkit',           contributionPct: 14 },
        { name: 'Rural Livelihoods & Jobs',             contributionPct: 12 },
        { name: 'Other Collections',                    contributionPct: 10 },
      ],
      agents: [
        { name: 'Lessons Explorer',                           usagePct: 30 },
        { name: 'Self-Service Portfolio Analysis (SSPA)',     usagePct: 22 },
        { name: 'Literature Review and Policy Paper Generator', usagePct: 20 },
        { name: 'Sherlock – Expertise Detective',             usagePct: 16 },
        { name: 'ISR Issues Explorer',                        usagePct: 12 },
      ],
      negativeDrivers: [
        { title: 'Smallholder context missing',    reports: 11, sharePct: 30 },
        { title: 'Yield figures outdated',         reports:  8, sharePct: 22 },
        { title: 'Generic policy advice',          reports:  7, sharePct: 18 },
        { title: 'Insufficient gender lens',       reports:  6, sharePct: 16 },
        { title: 'Weak market-linkage detail',     reports:  5, sharePct: 14 },
      ],
      subcategories: [
        { name: 'Climate-Smart Agriculture Practices', queries: 26, repeatRate: 58, retrievalSuccess: 78, negativePct: 20, positivePct: 72 },
        { name: 'Drought-Tolerant Seed Systems',       queries: 18, repeatRate: 50, retrievalSuccess: 74, negativePct: 22, positivePct: 70 },
        { name: 'Livestock & Pastoralist Resilience',  queries: 14, repeatRate: 46, retrievalSuccess: 72, negativePct: 26, positivePct: 66 },
        { name: 'Smallholder Finance & Insurance',     queries: 12, repeatRate: 42, retrievalSuccess: 68, negativePct: 28, positivePct: 64 },
        { name: 'Soil Health & Land Restoration',      queries: 10, repeatRate: 38, retrievalSuccess: 76, negativePct: 18, positivePct: 74 },
        { name: 'Agri Value Chains & Market Access',   queries:  9, repeatRate: 34, retrievalSuccess: 70, negativePct: 24, positivePct: 68 },
        { name: 'Food Security & Nutrition',           queries:  7, repeatRate: 30, retrievalSuccess: 74, negativePct: 20, positivePct: 70 },
      ],
      mapIntensity: {
        ke: 6, tz: 5, et: 6, ug: 4, rw: 4, mz: 3, za: 3,
        ng: 4, sn: 3, ml: 3, bj: 3,
        in: 5, bd: 5, pk: 4, np: 3,
        id: 3, vn: 3, kh: 3,
        br: 3, pe: 3,
      },
      regionQueries:  { afe: 64, afw: 22, eap: 12, eca:  6, lac: 10, mna:  6, sar: 32 },
      countryQueries: { ke: 30, tz: 12, et: 14, ug:  8, rw:  5, mz:  3, za:  3, ng: 10, sn:  4, ml:  3, bj:  2, in: 14, bd: 10, pk:  6, np:  3, id:  4, vn:  3, kh:  3, br:  4, pe:  3 },
    },

    // Other topic IDs fall back to Macroeconomic Research if the query param
    // doesn't match — production should hydrate these from the real catalogue.
    ml:   {} as CategoryData,
    cli:  {} as CategoryData,
    les:  {} as CategoryData,
    hf:   {} as CategoryData,
    oth:  {} as CategoryData,
    peer: {} as CategoryData,
    cel:  {} as CategoryData,
    syn:  {} as CategoryData,
    doc:  {} as CategoryData,
  };

  readonly active = signal<TopicId>('eg');
  readonly category = computed<CategoryData>(() => {
    const t = this.active();
    const found = this.categories[t];
    return found && found.id ? found : this.categories.eg;
  });

  domainLabel(d: KptDomain): string {
    if (d === 'knowledge') return 'Knowledge';
    if (d === 'people')    return 'People';
    return 'Tasks';
  }

  /** Generate a URL slug for collection/agent detail links. */
  slugFor(name: string): string { return toSlug(name); }


  // ============ Global Demand map ============
  private readonly sanitizer = inject(DomSanitizer);

  readonly mapMode = signal<MapMode>('region');
  setMapMode(m: MapMode) {
    this.mapMode.set(m);
    this.mapSelection.set(null);
  }

  readonly mapSelection = signal<{ name: string; queries: number } | null>(null);

  readonly mapSvg = signal<SafeHtml | null>(null);
  readonly mapHost = viewChild<ElementRef<HTMLElement>>('mapHost');

  // Pan / zoom state
  readonly mapScale = signal(1);
  readonly mapTx = signal(0);
  readonly mapTy = signal(0);
  readonly mapTransform = computed(
    () => `translate(${this.mapTx()}px, ${this.mapTy()}px) scale(${this.mapScale()})`,
  );
  readonly isPanning = signal(false);
  private static readonly MIN_ZOOM = 1;
  private static readonly MAX_ZOOM = 8;
  private panStart: { x: number; y: number; tx: number; ty: number } | null = null;
  private panMoved = false;

  constructor() {
    const route = inject(ActivatedRoute);
    const topicParam = route.snapshot.queryParamMap.get('topic') as TopicId | null;
    if (topicParam && this.categories[topicParam]?.id) {
      this.active.set(topicParam);
    }

    fetch('/world-map-coded.svg')
      .then(r => r.text())
      .then(svg => this.mapSvg.set(this.sanitizer.bypassSecurityTrustHtml(svg)));

    effect(() => {
      const host = this.mapHost()?.nativeElement;
      this.mapSvg();
      this.active();
      if (!host) return;
      setTimeout(() => this.tintMap(host), 0);
    });

    effect(() => {
      const host = this.mapHost()?.nativeElement;
      const s = this.mapScale();
      const mode = this.mapMode();
      this.mapSvg();
      if (!host) return;
      setTimeout(() => this.applyLabelVisibility(host, s, mode), 0);
    });
  }

  private tintMap(host: HTMLElement) {
    const svg = host.querySelector<SVGSVGElement>('svg');
    if (!svg) return;
    const intensityMap = this.category().mapIntensity;
    svg.querySelectorAll<SVGElement>('[id]').forEach(el => {
      const id = el.id?.toLowerCase();
      if (!id || id.startsWith('_') || id === 'world-map') return;
      const intensity = intensityMap[id] ?? 0;
      const region = ISO_TO_REGION[id] ?? '';
      const targets = el.tagName === 'g'
        ? el.querySelectorAll<SVGPathElement>('path')
        : [el as unknown as SVGPathElement];
      targets.forEach(p => {
        p.dataset['intensity'] = String(intensity);
        if (region) p.dataset['region'] = region;
        p.dataset['country'] = id;
      });
    });
    if (!svg.querySelector('g.labels')) this.buildCountryLabels(svg);
  }

  private buildCountryLabels(svg: SVGSVGElement) {
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

  private applyLabelVisibility(host: HTMLElement, s: number, mode: MapMode) {
    host.querySelectorAll<SVGTextElement>('text.country-label').forEach(t => {
      if (mode === 'region') { t.style.display = 'none'; return; }
      const cw = Number(t.dataset['bboxw'] ?? '0');
      const lw = Number(t.dataset['labelw'] ?? '0');
      t.style.display = cw * s >= lw * 0.9 ? '' : 'none';
    });
  }

  onMapClick(event: MouseEvent) {
    if (this.panMoved) { this.panMoved = false; return; }
    const target = event.target as Element | null;
    const path = target?.closest?.('path') as SVGPathElement | null;
    if (!path) { this.mapSelection.set(null); return; }
    const data = this.category();
    if (this.mapMode() === 'region') {
      const region = path.dataset['region'];
      if (!region) { this.mapSelection.set(null); return; }
      const label = REGION_LABEL[region] ?? region.toUpperCase();
      const queries = data.regionQueries[region] ?? 0;
      this.mapSelection.set({ name: label, queries });
    } else {
      const code = path.dataset['country'];
      if (!code) { this.mapSelection.set(null); return; }
      const label = COUNTRY_LABEL[code] ?? code.toUpperCase();
      const queries = data.countryQueries[code] ?? 0;
      this.mapSelection.set({ name: label, queries });
    }
  }

  onMapWheel(event: WheelEvent) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.mapScale.update(s =>
      Math.min(Analysis.MAX_ZOOM, Math.max(Analysis.MIN_ZOOM, s * factor)),
    );
  }

  onPanStart(event: MouseEvent) {
    if (event.button !== 0) return;
    this.panStart = { x: event.clientX, y: event.clientY, tx: this.mapTx(), ty: this.mapTy() };
    this.panMoved = false;
    this.isPanning.set(true);
  }
  onPanMove(event: MouseEvent) {
    if (!this.panStart) return;
    const dx = event.clientX - this.panStart.x;
    const dy = event.clientY - this.panStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.panMoved = true;
    this.mapTx.set(this.panStart.tx + dx);
    this.mapTy.set(this.panStart.ty + dy);
  }
  onPanEnd() {
    this.panStart = null;
    this.isPanning.set(false);
  }

  zoomIn()    { this.mapScale.update(s => Math.min(Analysis.MAX_ZOOM, s * 1.25)); }
  zoomOut()   { this.mapScale.update(s => Math.max(Analysis.MIN_ZOOM, s / 1.25)); }
  resetView() { this.mapScale.set(1); this.mapTx.set(0); this.mapTy.set(0); }

  // ============ Subcategory drawer ============
  // Two views: 'subcat' shows the AI insights + prompts table; 'prompt' shows
  // negative-feedback detail for a single prompt, with a back arrow returning
  // to the subcat view.
  readonly subDrawerSubcat = signal<Subcategory | null>(null);
  readonly subDrawerOpen = computed(() => this.subDrawerSubcat() !== null);
  readonly subDrawerView = signal<'subcat' | 'prompt'>('subcat');
  readonly subDrawerPrompt = signal<SubcatPrompt | null>(null);

  readonly subDrawerData = computed<SubcatDrawerData | null>(() => {
    const s = this.subDrawerSubcat();
    if (!s) return null;
    return SUBCAT_DRAWER_DATA[s.name] ?? buildFallbackSubcatData(s);
  });

  readonly subDrawerAiInsight = computed<SafeHtml | null>(() => {
    const data = this.subDrawerData();
    if (!data) return null;
    return this.sanitizer.bypassSecurityTrustHtml(data.aiInsightHtml);
  });

  openSubcatDrawer(s: Subcategory) {
    this.subDrawerSubcat.set(s);
    this.subDrawerView.set('subcat');
    this.subDrawerPrompt.set(null);
  }
  openSubcatPromptDetail(p: SubcatPrompt) {
    this.subDrawerPrompt.set(p);
    this.subDrawerView.set('prompt');
  }
  backToSubcat() {
    this.subDrawerView.set('subcat');
    this.subDrawerPrompt.set(null);
  }
  closeSubcatDrawer() {
    this.subDrawerSubcat.set(null);
    // Defer the view reset so the slide-out animation still shows content.
    setTimeout(() => {
      this.subDrawerView.set('subcat');
      this.subDrawerPrompt.set(null);
    }, 280);
  }
}

// ============================================================
// Subcategory drawer mock data — keyed by subcategory name. Names match the
// `subcategories[].name` strings in CategoryData above. Anything not in this
// map falls back to a generic template via buildFallbackSubcatData().
// ============================================================
const SUBCAT_DRAWER_DATA: Record<string, SubcatDrawerData> = {
  'Macroeconomic Stability': {
    name: 'Macroeconomic Stability',
    aiInsightHtml:
      'Users use K360 to understand the macroeconomic conditions affecting ' +
      "Ghana’s growth trajectory, with prompts focused on <strong>inflation</strong>, " +
      '<strong>debt restructuring</strong>, <strong>fiscal sustainability</strong>, ' +
      'and <strong>productivity challenges</strong>. Engagement is strongest across ' +
      '<strong>AFW</strong> and <strong>Africa-focused VPUs</strong> such as ' +
      '<strong>AFCE1</strong> and <strong>AFCE2</strong>, with frequent comparisons ' +
      'against peer economies like <strong>Kenya</strong> and <strong>Senegal</strong>. ' +
      'Users commonly draw from collections including “<strong>Country Growth and Jobs</strong>,” ' +
      '“<strong>Fiscal Policy and Growth</strong>,” and “<strong>Debt Sustainability Analysis</strong>” ' +
      'to benchmark reforms and identify strategies for long-term economic resilience.',
    topVpus: ['AFW', 'AFCE1', 'AFCE2'],
    topCollections: ['Country Growth and Jobs', 'Fiscal Policy and Growth', 'Debt Sustainability Analysis'],
    prompts: [
      // Each row represents a prompt *type* — i.e. many user submissions that
      // share the same intent. positiveCount / negativeCount are the
      // aggregated thumbs-up / thumbs-down totals; negativeBreakdown splits
      // the negatives across the five standard reason labels (sum =
      // negativeCount). otherComments are the free-text comments captured
      // when a user chose "Other" as the reason.
      {
        query: "What are the main challenges facing Ghana’s economic growth and productivity?",
        queries: 12, negativePct: 18, positivePct: 70,
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
        query: 'How is inflation impacting productivity and household spending in Ghana?',
        queries: 7, negativePct: 22, positivePct: 65,
        positiveCount: 46, negativeCount: 15,
        negativeBreakdown: [
          { label: NEG_REASON_LABELS[0], count: 6 },
          { label: NEG_REASON_LABELS[1], count: 5 },
          { label: NEG_REASON_LABELS[2], count: 0 },
          { label: NEG_REASON_LABELS[3], count: 1 },
          { label: NEG_REASON_LABELS[4], count: 3 },
        ],
        otherComments: [
          'Lacked breakdown by income quintile.',
          'Did not distinguish rural vs urban households.',
        ],
      },
      {
        query: "What are the implications of Ghana’s debt restructuring on future investment?",
        queries: 6, negativePct: 25, positivePct: 62,
        positiveCount: 37, negativeCount: 15,
        negativeBreakdown: [
          { label: NEG_REASON_LABELS[0], count: 5 },
          { label: NEG_REASON_LABELS[1], count: 6 },
          { label: NEG_REASON_LABELS[2], count: 0 },
          { label: NEG_REASON_LABELS[3], count: 2 },
          { label: NEG_REASON_LABELS[4], count: 2 },
        ],
        otherComments: [
          'Generic — needed Eurobond / Paris Club specifics.',
        ],
      },
      {
        query: "How does cedi depreciation affect Ghana’s investment climate?",
        queries: 6, negativePct: 28, positivePct: 58,
        positiveCount: 35, negativeCount: 17,
        negativeBreakdown: [
          { label: NEG_REASON_LABELS[0], count: 7 },
          { label: NEG_REASON_LABELS[1], count: 6 },
          { label: NEG_REASON_LABELS[2], count: 0 },
          { label: NEG_REASON_LABELS[3], count: 1 },
          { label: NEG_REASON_LABELS[4], count: 3 },
        ],
        otherComments: [
          'Wanted operational FDI-pipeline impact, not policy framing.',
          'Missed currency-hedging guidance.',
        ],
      },
      {
        query: "What sectors are contributing most to Ghana’s productivity slowdown?",
        queries: 5, negativePct: 14, positivePct: 75,
        positiveCount: 38, negativeCount: 7,
        negativeBreakdown: [
          { label: NEG_REASON_LABELS[0], count: 2 },
          { label: NEG_REASON_LABELS[1], count: 3 },
          { label: NEG_REASON_LABELS[2], count: 0 },
          { label: NEG_REASON_LABELS[3], count: 0 },
          { label: NEG_REASON_LABELS[4], count: 2 },
        ],
        otherComments: [
          'Needed peer benchmarks vs Kenya, Senegal, Côte d’Ivoire.',
        ],
      },
      {
        query: 'What structural labor market issues are limiting economic growth in Ghana?',
        queries: 4, negativePct: 20, positivePct: 68,
        positiveCount: 27, negativeCount: 8,
        negativeBreakdown: [
          { label: NEG_REASON_LABELS[0], count: 3 },
          { label: NEG_REASON_LABELS[1], count: 3 },
          { label: NEG_REASON_LABELS[2], count: 0 },
          { label: NEG_REASON_LABELS[3], count: 1 },
          { label: NEG_REASON_LABELS[4], count: 1 },
        ],
        otherComments: [
          'Skipped youth NEET rates and skills-matching programs.',
        ],
      },
      {
        query: 'What barriers are preventing SMEs from scaling in Ghana?',
        queries: 4, negativePct: 12, positivePct: 76,
        positiveCount: 30, negativeCount: 5,
        negativeBreakdown: [
          { label: NEG_REASON_LABELS[0], count: 2 },
          { label: NEG_REASON_LABELS[1], count: 2 },
          { label: NEG_REASON_LABELS[2], count: 0 },
          { label: NEG_REASON_LABELS[3], count: 0 },
          { label: NEG_REASON_LABELS[4], count: 1 },
        ],
        otherComments: [
          'Wanted Enterprise Survey data, not general assertions.',
        ],
      },
      {
        query: 'How can Ghana attract more foreign direct investment?',
        queries: 4, negativePct: 16, positivePct: 72,
        positiveCount: 29, negativeCount: 6,
        negativeBreakdown: [
          { label: NEG_REASON_LABELS[0], count: 3 },
          { label: NEG_REASON_LABELS[1], count: 2 },
          { label: NEG_REASON_LABELS[2], count: 0 },
          { label: NEG_REASON_LABELS[3], count: 0 },
          { label: NEG_REASON_LABELS[4], count: 1 },
        ],
        otherComments: [
          'Needed concrete FDI case studies, not policy lists.',
        ],
      },
      {
        query: 'How does Ghana compare to Kenya and Senegal in economic resilience?',
        queries: 3, negativePct: 24, positivePct: 65,
        positiveCount: 20, negativeCount: 8,
        negativeBreakdown: [
          { label: NEG_REASON_LABELS[0], count: 2 },
          { label: NEG_REASON_LABELS[1], count: 4 },
          { label: NEG_REASON_LABELS[2], count: 0 },
          { label: NEG_REASON_LABELS[3], count: 1 },
          { label: NEG_REASON_LABELS[4], count: 1 },
        ],
        otherComments: [
          'Comparison used 2022 figures — wanted 2025 indicators.',
        ],
      },
      {
        query: "How do power and transport infrastructure gaps affect Ghana’s competitiveness?",
        queries: 2, negativePct: 30, positivePct: 55,
        positiveCount: 11, negativeCount: 7,
        negativeBreakdown: [
          { label: NEG_REASON_LABELS[0], count: 3 },
          { label: NEG_REASON_LABELS[1], count: 2 },
          { label: NEG_REASON_LABELS[2], count: 0 },
          { label: NEG_REASON_LABELS[3], count: 1 },
          { label: NEG_REASON_LABELS[4], count: 1 },
        ],
        otherComments: [
          'Missed PPP pipeline status and unit-cost benchmarks.',
        ],
      },
    ],
  },
};

function buildFallbackSubcatData(s: Subcategory): SubcatDrawerData {
  // Aggregate per prompt-type. Counts are inflated 10× so the breakdown
  // across five reasons reads visually; the displayed totals row stays
  // anchored to `queries` from the parent table.
  const otherSamples = [
    `Did not link to the latest ${s.name} brief.`,
    `Wanted region-specific examples for ${s.name.toLowerCase()}.`,
    `Missed cross-cutting comparisons with peer economies.`,
  ];
  const build = (query: string, queries: number, idx: number): SubcatPrompt => {
    const positiveCount = Math.max(1, Math.round(queries * s.positivePct / 100 * 10));
    const negativeCount = Math.max(1, Math.round(queries * s.negativePct / 100 * 10));
    // Distribute negatives across the five reason buckets — rough but stable.
    const weights = [0.35, 0.30, 0.05, 0.10, 0.20];
    const counts = weights.map(w => Math.round(negativeCount * w));
    // Adjust last bucket so the sum matches negativeCount exactly.
    const drift = negativeCount - counts.reduce((a, b) => a + b, 0);
    counts[4] = Math.max(0, counts[4] + drift);
    return {
      query, queries,
      negativePct: s.negativePct, positivePct: s.positivePct,
      positiveCount, negativeCount,
      negativeBreakdown: NEG_REASON_LABELS.map((label, i) => ({ label, count: counts[i] })),
      otherComments: counts[4] > 0 ? [otherSamples[idx % otherSamples.length]] : [],
    };
  };
  return {
    name: s.name,
    aiInsightHtml:
      `Users explore <strong>${s.name}</strong> through ${s.queries} prompts focused on ` +
      'sector-specific questions and benchmarking against peer economies. Engagement is ' +
      'distributed across regional VPUs, with users frequently consulting linked ' +
      'collections to ground their queries.',
    topVpus: ['AFW', 'AFCE1', 'AFCE2'],
    topCollections: ['Country Growth and Jobs', 'Fiscal Policy and Growth'],
    prompts: [
      build(`What are the key drivers in ${s.name}?`,                      Math.max(1, Math.round(s.queries * 0.4)),  0),
      build(`How does Ghana compare to peers on ${s.name.toLowerCase()}?`, Math.max(1, Math.round(s.queries * 0.25)), 1),
      build(`What policy reforms are needed for ${s.name.toLowerCase()}?`, Math.max(1, Math.round(s.queries * 0.2)),  2),
    ],
  };
}

// ============================================================
// Region + Country helpers (lightweight — only what this page needs).
// ============================================================
const ISO_TO_REGION: Record<string, string> = {
  // AFE
  ke: 'afe', tz: 'afe', et: 'afe', za: 'afe', ug: 'afe', rw: 'afe', mz: 'afe',
  // AFW
  ng: 'afw', sn: 'afw', ci: 'afw', gh: 'afw', cm: 'afw', ml: 'afw', bj: 'afw',
  // EAP
  cn: 'eap', id: 'eap', vn: 'eap', ph: 'eap', th: 'eap', my: 'eap', kh: 'eap',
  // ECA
  pl: 'eca', tr: 'eca', ua: 'eca', ro: 'eca', uz: 'eca', kz: 'eca',
  // LAC
  br: 'lac', mx: 'lac', co: 'lac', ar: 'lac', pe: 'lac', cl: 'lac',
  // MNA
  eg: 'mna', ma: 'mna', tn: 'mna', ye: 'mna', jo: 'mna', dz: 'mna', iq: 'mna',
  // SAR
  in: 'sar', pk: 'sar', bd: 'sar', lk: 'sar', np: 'sar', af: 'sar', bt: 'sar',
};

const REGION_LABEL: Record<string, string> = {
  afe: 'Eastern & Southern Africa',
  afw: 'Western & Central Africa',
  eap: 'East Asia & Pacific',
  eca: 'Europe & Central Asia',
  lac: 'Latin America & Caribbean',
  mna: 'Middle East & North Africa',
  sar: 'South Asia',
};

const COUNTRY_LABEL: Record<string, string> = {
  gh: 'Ghana', ng: 'Nigeria', sn: 'Senegal', ci: "Côte d'Ivoire", ke: 'Kenya',
  tz: 'Tanzania', et: 'Ethiopia', za: 'South Africa',
  in: 'India', bd: 'Bangladesh', pk: 'Pakistan', lk: 'Sri Lanka',
  cn: 'China', id: 'Indonesia', vn: 'Vietnam',
  br: 'Brazil', mx: 'Mexico',
};
