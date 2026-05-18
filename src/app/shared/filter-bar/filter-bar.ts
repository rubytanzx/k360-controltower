import { Component, computed, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';

type FilterName = 'date' | 'country' | 'vertical' | 'sector' | null;
type DateMode = 'month' | 'year';

interface CountryGroup {
  code: string;
  region: string;
  countries: string[];
}

@Component({
  selector: 'app-filter-bar',
  imports: [TablerIconComponent],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.css',
})
export class FilterBar {
  readonly openFilter = signal<FilterName>(null);
  readonly searchQuery = signal('');

  // Date
  readonly dateMode = signal<DateMode>('month');
  readonly dateYear = signal(2025);
  readonly dateMonth = signal(1);

  // Other filters
  readonly selectedCountry = signal('All Countries');
  readonly selectedVertical = signal('All Verticals');
  readonly selectedSector = signal('All Sectors');

  readonly months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  readonly years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

  // Countries grouped by World Bank region
  readonly countryGroups: CountryGroup[] = [
    {
      code: 'AFR',
      region: 'Sub-Saharan Africa',
      countries: [
        "Côte d'Ivoire",
        'Ethiopia',
        'Ghana',
        'Kenya',
        'Mozambique',
        'Nigeria',
        'Senegal',
        'South Africa',
        'Tanzania',
      ],
    },
    {
      code: 'EAP',
      region: 'East Asia & Pacific',
      countries: ['Cambodia', 'China', 'Indonesia', 'Philippines', 'Thailand', 'Vietnam'],
    },
    {
      code: 'ECA',
      region: 'Europe & Central Asia',
      countries: ['Türkiye', 'Ukraine', 'Uzbekistan'],
    },
    {
      code: 'LAC',
      region: 'Latin America & Caribbean',
      countries: ['Argentina', 'Brazil', 'Colombia', 'Mexico', 'Peru'],
    },
    {
      code: 'MNA',
      region: 'Middle East & North Africa',
      countries: ['Egypt'],
    },
    {
      code: 'SAR',
      region: 'South Asia',
      countries: ['Afghanistan', 'Bangladesh', 'India', 'Pakistan'],
    },
  ];

  readonly verticals = [
    'All Verticals',
    'Macroeconomics, Trade & Investment (MTI)',
    'Finance, Competitiveness & Innovation (FCI)',
    'Infrastructure',
    'Human Development',
    'Poverty & Equity',
    'Environment & Natural Resources',
    'Governance',
    'Agriculture & Food',
    'Urban, Resilience & Land',
    'Gender',
  ];

  readonly sectors = [
    'All Sectors',
    'Energy',
    'Transport',
    'Water & Sanitation',
    'Digital',
    'Education',
    'Health',
    'Social Protection',
    'Agriculture',
    'Forestry & Natural Resources',
    'Public Administration',
    'Financial Markets',
  ];

  readonly dateLabel = computed(() => {
    if (this.dateMode() === 'year') return String(this.dateYear());
    return `${this.months[this.dateMonth()]} ${this.dateYear()}`;
  });

  readonly countryLabel = computed(() => {
    const c = this.selectedCountry();
    return c === 'All Countries' ? 'All' : c;
  });

  readonly verticalLabel = computed(() => {
    const v = this.selectedVertical();
    if (v === 'All Verticals') return 'All';
    const acronym = v.match(/\(([A-Z]{2,5})\)$/);
    if (acronym) return acronym[1];
    const idx = v.indexOf(' (');
    return idx > -1 ? v.slice(0, idx) : v;
  });

  readonly sectorLabel = computed(() => {
    const s = this.selectedSector();
    return s === 'All Sectors' ? 'All' : s;
  });

  readonly filteredCountryGroups = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.countryGroups;
    return this.countryGroups
      .map((g) => ({
        ...g,
        countries: g.countries.filter(
          (c) => c.toLowerCase().includes(q) || g.region.toLowerCase().includes(q) || g.code.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.countries.length > 0);
  });

  readonly filteredVerticals = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.verticals;
    return this.verticals.filter((v) => v.toLowerCase().includes(q));
  });

  readonly filteredSectors = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.sectors;
    return this.sectors.filter((s) => s.toLowerCase().includes(q));
  });

  readonly hasCountryMatches = computed(() => this.filteredCountryGroups().length > 0);

  toggleFilter(name: Exclude<FilterName, null>) {
    this.openFilter.update((c) => (c === name ? null : name));
    this.searchQuery.set('');
  }
  closeFilter() {
    this.openFilter.set(null);
    this.searchQuery.set('');
  }
  onSearchInput(value: string) {
    this.searchQuery.set(value);
  }

  setDateMode(m: DateMode) { this.dateMode.set(m); }
  stepYear(d: number) { this.dateYear.update((y) => y + d); }
  pickMonth(i: number) { this.dateMonth.set(i); this.closeFilter(); }
  pickYear(y: number) {
    this.dateYear.set(y);
    if (this.dateMode() === 'year') this.closeFilter();
  }
  pickCountry(c: string) { this.selectedCountry.set(c); this.closeFilter(); }
  pickVertical(v: string) { this.selectedVertical.set(v); this.closeFilter(); }
  pickSector(s: string) { this.selectedSector.set(s); this.closeFilter(); }
}
