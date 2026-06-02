import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChildren } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Dashboard } from '../dashboard/dashboard';
import { Assets } from '../assets/assets';
import { Prompts } from '../prompts/prompts';
import { Users } from '../users/users';
import { Feedback } from '../feedback/feedback';
import { Performance } from '../performance/performance';
import { ScrollNavService } from '../shared/scroll-nav.service';

@Component({
  selector: 'app-home',
  imports: [Dashboard, Assets, Prompts, Users, Feedback, Performance],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly nav = inject(ScrollNavService);
  private readonly sections = viewChildren<ElementRef<HTMLElement>>('section');
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    // Decide initial scroll target: explicit request from sidebar takes precedence,
    // otherwise infer from the current path (e.g. /assets → 'collections',
    // /assets?tab=agents → 'agents').
    const pending = this.nav.pendingTarget();
    const fromPath = this.route.snapshot.url[0]?.path;
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    let target: string;
    if (pending) {
      target = pending;
    } else if (fromPath === 'assets') {
      target = tabParam === 'agents' ? 'agents' : 'collections';
    } else {
      target = fromPath ?? 'dashboard';
    }
    this.nav.pendingTarget.set(null);

    // Defer to allow child components' content to mount before measuring.
    requestAnimationFrame(() => {
      this.scrollTo(target, target === 'dashboard' ? 'auto' : 'auto');
      this.observeSections();
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private scrollTo(id: string, behavior: ScrollBehavior) {
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior, block: 'start' });
  }

  private observeSections() {
    const els = this.sections().map((r) => r.nativeElement);
    if (!els.length) return;
    this.observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top of the viewport that is at least partially visible.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const id = (visible.target as HTMLElement).dataset['sectionId'];
          if (id) this.nav.activeSection.set(id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    );
    els.forEach((el) => this.observer!.observe(el));
  }
}
