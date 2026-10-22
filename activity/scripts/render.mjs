// Serves the built card (dist/) and screenshots it into ../assets/activity-{light,dark}.png
// for the profile README, which cannot run React.
//
// Data: with GH_CONTRIB_TOKEN (a token of the profile owner) the calendar comes from
// GraphQL and includes private contributions; without it, the public calendar is used.
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

const LOGIN = "emrebarkind";
const root = fileURLToPath(new URL("..", import.meta.url));
const assets = fileURLToPath(new URL("../../assets/", import.meta.url));

async function fromGraphQL(token) {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(to.getFullYear() - 1);
  from.setDate(from.getDate() + 1);

  const query = `query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar { weeks { contributionDays { date contributionCount } } }
      }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login: LOGIN, from: from.toISOString(), to: to.toISOString() } }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`GraphQL: ${JSON.stringify(body.errors ?? res.status)}`);

  return body.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((week) => week.contributionDays)
    .map((day) => ({ date: day.date, count: day.contributionCount }));
}

async function fromPublicCalendar() {
  const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${LOGIN}?y=last`);
  if (!res.ok) throw new Error(`calendar API answered ${res.status}`);
  const body = await res.json();
  return body.contributions.map(({ date, count }) => ({ date, count }));
}

const token = process.env.GH_CONTRIB_TOKEN;
const days = token ? await fromGraphQL(token) : await fromPublicCalendar();
const total = days.reduce((sum, day) => sum + day.count, 0);
console.log(`${token ? "graphql" : "public calendar"}: ${total} contributions, ${days.length} days`);

const server = await preview({ root, preview: { port: 4173, strictPort: true } });
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

try {
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({
      viewport: { width: 900, height: 600 },
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
      colorScheme: scheme,
    });
    await page.addInitScript((data) => {
      window.__ACTIVITY__ = data;
    }, days);
    await page.goto("http://localhost:4173/");
    await page.locator("#card > div").waitFor();
    await page.waitForTimeout(400);

    const out = `${assets}activity-${scheme}.png`;
    await page.locator("#card").screenshot({ path: out, omitBackground: true });
    console.log(`wrote ${out}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.httpServer.close();
}
