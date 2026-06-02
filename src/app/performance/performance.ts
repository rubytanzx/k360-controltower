import { Component } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';

interface PerfKpi {
  title: string;
  value: string;
  delta?: string;
  deltaPositiveIsGood?: boolean;
  sub?: string;
}

@Component({
  selector: 'app-performance',
  imports: [TablerIconComponent],
  templateUrl: './performance.html',
  styleUrl: './performance.css',
})
export class Performance {
  readonly kpis: PerfKpi[] = [
    {
      title: 'AI Response Time',
      value: '5.2s',
      delta: '+18%',
      deltaPositiveIsGood: false,
      sub: 'avg. time to first token',
    },
    {
      title: 'No Answer Events',
      value: '5',
      delta: '-2 vs last month',
      deltaPositiveIsGood: true,
      sub: 'queries returning no result',
    },
    {
      title: 'Error Rate',
      value: '1.3%',
      delta: '-0.4pp',
      deltaPositiveIsGood: true,
      sub: 'failed agent calls',
    },
    {
      title: 'Avg. Session Length',
      value: '4m 12s',
      delta: '+8%',
      deltaPositiveIsGood: true,
      sub: 'time on platform per visit',
    },
  ];

  deltaClass(kpi: PerfKpi): string {
    if (!kpi.delta) return '';
    const isPositive = kpi.delta.startsWith('+');
    return (isPositive === kpi.deltaPositiveIsGood) ? 'delta-good' : 'delta-bad';
  }
}
