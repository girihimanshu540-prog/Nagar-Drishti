import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { PageHead } from '@/components/bits';

const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: 'status',
    title: 'Who runs this service',
    body: (
      <>
        <p>NagarDrishti is <b>not an official municipal service</b>. It is an independent road-hazard tracker that is pending authorisation by its operator. Filing a report here does not formally notify any municipal body, and no repair time is promised or guaranteed.</p>
        <p data-testid="text-operator-contact"><b>Operator contact:</b> not yet configured. The operator must publish a contact address here before this notice is complete.</p>
      </>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li><b>Account details:</b> your name, email address and a hashed password. Your role (citizen, contractor, engineer, commissioner) decides what you can see.</li>
        <li><b>Photos:</b> the live camera photo you take when reporting a hazard, or a contractor takes as repair evidence. Gallery uploads are not accepted.</li>
        <li><b>Location:</b> the precise GPS position and its accuracy at the moment of capture, plus the capture time. Location is read only when you take a photo, never in the background.</li>
        <li><b>Activity:</b> a timeline of actions on each ticket, such as assignment, repair submission and engineer decisions, with the name of the person who acted.</li>
      </ul>
    ),
  },
  {
    id: 'who',
    title: 'Who can see what',
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li><b>Private evidence</b> (photos, precise GPS, report details and timelines) is visible only to the citizen who reported it and to signed-in staff with access to that ticket: the assigned contractor, junior engineers and commissioners.</li>
        <li><b>The public</b> sees only a ticket ID, title, status, ward and a general, approximate location rounded to about 100 m. Photos, contractor identity and timelines are not public.</li>
      </ul>
    ),
  },
  {
    id: 'review',
    title: 'How reports and repairs are checked',
    body: (
      <>
        <p>New reports pass simple automatic checks only: that a photo is attached, that it was taken recently, and that the GPS reading is accurate enough. Passing these checks does not confirm that a hazard exists. Every report is listed as an unverified road hazard report.</p>
        <p>Repair evidence is never closed automatically. Each repair is reviewed by a human junior engineer, who approves or rejects it with written notes. No AI, machine-learning model or external image-analysis service processes your photos.</p>
      </>
    ),
  },
  {
    id: 'safety',
    title: 'Safety and good practice',
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>This is not an emergency service. For accidents or immediate danger, contact local emergency services.</li>
        <li>Only take photos where it is safe to stand. Do not stop in traffic.</li>
        <li>Frame the road surface. Do not photograph faces, vehicle number plates or the inside of private property.</li>
      </ul>
    ),
  },
  {
    id: 'third',
    title: 'Third-party requests',
    body: (
      <p>Map tiles are loaded from OpenStreetMap tile servers, and fonts are loaded from Google Fonts. When a map or page loads, those providers receive your IP address and browser details as part of the request. Photos and GPS from your reports are not sent to them.</p>
    ),
  },
  {
    id: 'retention',
    title: 'How long data is kept',
    body: (
      <p data-testid="text-retention"><b>Retention period:</b> not yet configured. The operator must set and publish how long photos, locations and accounts are kept, and how to request deletion, before this notice is complete.</p>
    ),
  },
];

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl" aria-labelledby="privacy-title">
      <PageHead kicker="Public notice" title="Privacy and how this service works" />
      <p className="rise -mt-2 mb-6 text-sm text-muted-foreground">Plain-language summary of what NagarDrishti collects when you report a road hazard, who can see it, and what this service is not.</p>
      <nav aria-label="On this page" className="rise mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="inline-flex min-h-[40px] items-center rounded-sm border border-border px-3 text-xs text-muted-foreground hover:border-primary hover:text-primary">{s.title}</a>)}
      </nav>
      <div className="space-y-4">
        {SECTIONS.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="rise scroll-mt-20 rounded-md border border-card-border bg-card/80 p-4 md:p-5" style={{ animationDelay: `${i * 40}ms` }}>
            <h2 id={`${s.id}-h`} className="mb-2 font-display text-lg font-bold">{s.title}</h2>
            <div className="space-y-2 text-sm leading-relaxed text-foreground/85">{s.body}</div>
          </section>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/report" className="inline-flex min-h-[44px] items-center rounded-sm bg-primary px-4 font-semibold text-primary-foreground" data-testid="link-privacy-report">Report a road hazard</Link>
        <Link href="/public" className="inline-flex min-h-[44px] items-center rounded-sm border border-border px-4 hover:border-primary" data-testid="link-privacy-public">Public tracker</Link>
      </div>
    </article>
  );
}
