import { Component, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { FilterBar } from '../shared/filter-bar/filter-bar';

interface FeedbackKpi {
  title: string;
  value: string;
  delta: string;
  deltaTone?: 'good' | 'bad';
}

@Component({
  selector: 'app-feedback',
  imports: [TablerIconComponent, FilterBar],
  templateUrl: './feedback.html',
  styleUrl: './feedback.css',
})
export class Feedback {
  readonly kpis: FeedbackKpi[] = [
    { title: 'Unique Staff with Feedback', value: '575', delta: '+8.4%' },
    { title: 'Total Feedback Events', value: '18,450', delta: '+24%' },
    { title: 'Negative Rate', value: '4.2%', delta: '+3.5%', deltaTone: 'bad' },
    { title: 'Search Success Rate', value: '80%', delta: '+2pp' },
  ];

  readonly searchSuccessSub = '% of sessions where staff accessed at least one retrieved result';

  readonly negativeDrivers = ['Not factually correct', 'Did not follow instructions', 'Offensive / Unsafe'];

  readonly impactedAssets = [
    { name: 'Operational Policies Library', pct: 58 },
    { name: 'Open Knowledge Repository (OKR)', pct: 42 },
  ];

  readonly trendCadence = signal<'monthly' | 'weekly'>('monthly');

  readonly positiveLinePath =
    'M 0,140 C 60,148 110,150 160,142 S 250,118 310,108 S 420,60 480,60 S 560,40 600,32';
  readonly negativeLinePath =
    'M 0,178 C 60,182 110,184 160,180 S 250,170 310,166 S 420,150 480,160 S 560,168 600,176';
  readonly positiveAreaPath =
    'M 0,140 C 60,148 110,150 160,142 S 250,118 310,108 S 420,60 480,60 S 560,40 600,32 L 600,220 L 0,220 Z';
  readonly yAxisTicks = [200, 150, 100, 50, 0];

  setTrendCadence(c: 'monthly' | 'weekly') {
    this.trendCadence.set(c);
  }
}
