import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { chromium } from "playwright";
import * as readline from "readline";

export const AUTH_STATE_PATH = resolve(process.cwd(), "scripts/.auth/youtube-state.json");

export function hasAuthState(): boolean {
  return existsSync(AUTH_STATE_PATH);
}

export function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

export async function loginAndSaveSession(): Promise<void> {
  console.log("Opening browser for YouTube login…");
  console.log("1. Sign in to your Google/YouTube account");
  console.log("2. Complete any verification if prompted");
  console.log("3. Return here and press Enter to save the session\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();
  await page.goto("https://www.youtube.com", { waitUntil: "domcontentloaded" });

  await waitForEnter("\nPress Enter after you are logged in to YouTube… ");

  mkdirSync(dirname(AUTH_STATE_PATH), { recursive: true });
  await context.storageState({ path: AUTH_STATE_PATH });
  await browser.close();

  console.log(`\nSession saved to ${AUTH_STATE_PATH}`);
  console.log("Future scrape runs will reuse this login (use --auth).");
}
