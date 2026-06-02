import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { AiChatService } from './shared/ai-chat.service';
import { ScrollNavService } from './shared/scroll-nav.service';
import { DateRangeFilter } from './shared/date-range-filter/date-range-filter';

type Workspace = 'wb' | 'ops';

interface NavLink {
  label: string;
  icon: string;
  sectionId?: string;
}

type AiSection =
  | { type: 'p'; text: string }
  | { type: 'bullets'; items: string[] };

type AiMessage =
  | { role: 'user'; text: string }
  | { role: 'ai'; sections: AiSection[]; sourcesCount?: number };

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TablerIconComponent, DateRangeFilter],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('wb-control-tower');
  readonly expanded = signal(false);

  readonly nav: NavLink[] = [
    { label: 'Home', icon: 'home', sectionId: 'dashboard' },
    { label: 'Collections', icon: 'database', sectionId: 'collections' },
    { label: 'Agents', icon: 'robot', sectionId: 'agents' },
    { label: 'Prompts', icon: 'messages', sectionId: 'prompts' },
    { label: 'Users', icon: 'users-group', sectionId: 'users' },
    { label: 'Feedback', icon: 'message-check', sectionId: 'feedback' },
    { label: 'Performance', icon: 'gauge', sectionId: 'performance' },
  ];

  readonly footerLinks: NavLink[] = [
    { label: 'Help', icon: 'help-circle' },
  ];

  readonly workspace = signal<Workspace>('wb');
  readonly scrolled = signal(false);

  @HostListener('window:scroll')
  onScroll() { this.scrolled.set(window.scrollY > 2); }

  private readonly router = inject(Router);
  private readonly scrollNav = inject(ScrollNavService);
  readonly activeSection = this.scrollNav.activeSection;

  toggle() {
    this.expanded.update((v) => !v);
  }

  goToSection(id: string) {
    // Detail pages (e.g. /assets/collection/foo) aren't part of the one-page
    // scroll. From there, route back to Home and remember which section to
    // land on; otherwise smooth-scroll in place.
    const onHome = this.router.url === '/' || /^\/(assets|prompts|users|feedback)(\?|$)/.test(this.router.url);
    if (!onHome) {
      this.scrollNav.pendingTarget.set(id);
      this.router.navigateByUrl('/');
      return;
    }
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.scrollNav.activeSection.set(id);
  }

  // ---- Ask AI panel (state lives in shared service so any page can open it) ----
  private readonly chat = inject(AiChatService);
  readonly aiOpen = this.chat.isOpen;
  readonly aiInput = this.chat.input;

  // Empty by default — the panel opens with the welcome state until the user sends a message.
  readonly aiMessages = signal<AiMessage[]>([]);

  readonly aiSuggestions: string[] = [
    'Which region is adoption picking up in?',
    "What's driving the negative feedback spike this period?",
    'Where are the biggest content gaps in K360?',
  ];

  useSuggestion(text: string) {
    this.chat.setInput(text);
  }

  sendMessage() {
    const text = this.aiInput().trim();
    if (!text) return;

    this.aiMessages.update((msgs) => [...msgs, { role: 'user', text }]);
    this.chat.setInput('');

    setTimeout(() => {
      this.aiMessages.update((msgs) => [...msgs, this.mockResponse(text)]);
    }, 700);
  }

  private mockResponse(prompt: string): AiMessage {
    const t = prompt.toLowerCase();

    if (t.includes('region') && t.includes('adopt')) {
      return {
        role: 'ai',
        sections: [
          { type: 'p', text: 'Adoption is picking up fastest in AFW and SAR this period.' },
          { type: 'bullets', items: [
            'AFW (Western and Central Africa) — top 3 VPUs by visits: AFWW1 (100), AFCE2 (92), AFCE1 (86)',
            'SAR (South Asia) — strong India contribution (4,100 queries)',
            'ECA shows moderate uplift, driven by expertise search and TOR generation',
          ] },
          { type: 'p', text: 'Knowledge-domain queries dominate in AFW (Ghana focus); SAR is split across Knowledge and Tasks.' },
        ],
        sourcesCount: 4,
      };
    }

    if (t.includes('negative') || t.includes('spike') || t.includes('feedback')) {
      return {
        role: 'ai',
        sections: [
          { type: 'p', text: 'The negative spike is concentrated in TOR Generation (142 affected prompts).' },
          { type: 'bullets', items: [
            'Macroeconomic Research — 86 prompts, no dedicated collection',
            'Expert & People Discovery · ECA — 54 prompts, Sherlock profile gaps',
            'Top drivers: "Not factually correct" and "Did not follow instructions" — both Tasks-tagged',
          ] },
          { type: 'p', text: 'TOR Genie has the highest weighted impact score (619). Recommend prioritising review of TOR drafting failures before broader fixes.' },
        ],
        sourcesCount: 3,
      };
    }

    if (t.includes('content gap') || t.includes('collection') || t.includes('coverage')) {
      return {
        role: 'ai',
        sections: [
          { type: 'p', text: 'Three significant content gaps surfaced this period:' },
          { type: 'bullets', items: [
            'Macroeconomic Research — 56 prompts, no dedicated collection',
            'Housing Finance · LCR — 18 prompts, no dedicated collection',
            'Port Governance — 14 prompts, no dedicated collection',
          ] },
          { type: 'p', text: 'High demand with zero K360 supply. Consider dedicated collections or routing to Sherlock with enriched expert profiles.' },
        ],
        sourcesCount: 5,
      };
    }

    return {
      role: 'ai',
      sections: [
        { type: 'p', text: 'Looking across your K360 metrics for Jan – May 2026:' },
        { type: 'p', text: 'Total usage 28,912 visits with 3,095 unique active staff (16.73% adoption). Retention is strong at 83.88%, and TOR Generation is the dominant agent by volume.' },
        { type: 'p', text: 'For a deeper drill-down, try one of the suggested prompts or specify a topic, agent, or region.' },
      ],
      sourcesCount: 2,
    };
  }

  toggleAi() { this.chat.toggle(); }
  openAi()   { this.chat.open(); }
  closeAi()  { this.chat.close(); }
  setAiInput(value: string) { this.chat.setInput(value); }
}
