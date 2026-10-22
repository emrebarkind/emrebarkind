// Builds nothing itself: serves the built card (dist/) and screenshots it into
// ../assets/activity.png for the profile README, which cannot run React.
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = fileURLToPath(new URL("../../assets/activity.png", import.meta.url));

const server = await preview({ root, preview: { port: 4173, strictPort: true } });
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 600 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });

  const calendar = page.waitForResponse((res) => res.url().includes("github-contributions-api"), {
    timeout: 30_000,
  });
  await page.goto("http://localhost:4173/");
  const res = await calendar;
  if (!res.ok()) throw new Error(`calendar API answered ${res.status()}`);

  // let the events request settle and React paint the real data
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  const heading = await page.locator("[data-slot=github-activity] p").first().textContent();
  console.log(`rendering: ${heading}`);

  await page.locator("[data-slot=github-activity]").screenshot({ path: out, omitBackground: true });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
  server.httpServer.close();
}
