import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';

interface NavLink {
  label: string;
  icon: string;
  route?: string;
}

type AiSection =
  | { type: 'p'; text: string }
  | { type: 'bullets'; items: string[] };

type AiMessage =
  | { role: 'user'; text: string }
  | { role: 'ai'; sections: AiSection[]; sourcesCount?: number };

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TablerIconComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('wb-control-tower');
  readonly expanded = signal(false);

  readonly nav: NavLink[] = [
    { label: 'Home', icon: 'home', route: '/' },
    { label: 'Assets', icon: 'database', route: '/assets' },
    { label: 'Prompts', icon: 'messages', route: '/prompts' },
    { label: 'Users', icon: 'users', route: '/users' },
    { label: 'Feedback', icon: 'message-report', route: '/feedback' },
  ];

  readonly footerLinks: NavLink[] = [
    { label: 'Help', icon: 'help-circle' },
    { label: 'Switch workspace', icon: 'arrows-right-left' },
  ];

  toggle() {
    this.expanded.update((v) => !v);
  }

  // ---- Ask AI panel ----
  readonly aiOpen = signal(false);
  readonly aiInput = signal('');

  readonly aiMessages: AiMessage[] = [
    {
      role: 'user',
      text: 'Why is "Policies & Guidelines" the largest category in the Knowledge breakdown?',
    },
    {
      role: 'ai',
      sections: [
        {
          type: 'p',
          text: '"Policies & Guidelines" accounts for 17% of total prompt volume this month — the highest within the Knowledge theme.',
        },
        { type: 'p', text: 'Drilldown shows:' },
        {
          type: 'bullets',
          items: [
            'Most activity relates to Governance & Compliance subcategories',
            '62% of negative feedback is concentrated in this area',
            'Many prompts request procedural clarification rather than summaries',
          ],
        },
        {
          type: 'p',
          text: 'This suggests users are relying on the platform for operational decision support, not just reference lookup.',
        },
      ],
      sourcesCount: 3,
    },
    {
      role: 'user',
      text: 'Are there any emerging topics gaining traction over the past 30 days?',
    },
  ];

  toggleAi() {
    this.aiOpen.update((v) => !v);
  }

  openAi() {
    this.aiOpen.set(true);
  }

  closeAi() {
    this.aiOpen.set(false);
  }

  setAiInput(value: string) {
    this.aiInput.set(value);
  }
}
