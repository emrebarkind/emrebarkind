import type { ActivityDay } from "@/components/ui/github-activity-grid";

declare global {
  interface Window {
    /** Set by scripts/render.mjs so the card renders the data it fetched. */
    __ACTIVITY__?: ActivityDay[];
  }
}

const CALENDAR_API = "https://github-contributions-api.jogruber.de/v4";

/** Public calendar only; private contributions count once the profile shares them. */
export async function fetchPublicDays(login: string): Promise<ActivityDay[]> {
  const res = await fetch(`${CALENDAR_API}/${login}?y=last`);
  if (!res.ok) throw new Error(`calendar API answered ${res.status}`);
  const body: { contributions: { date: string; count: number }[] } = await res.json();
  return body.contributions.map(({ date, count }) => ({ date, count }));
}
