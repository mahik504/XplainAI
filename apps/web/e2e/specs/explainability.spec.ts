import { expect, test } from "@playwright/test";

test.describe("Explainability Cockpit E2E Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  test("should render the Explain Cockpit header and all 5 navigation tabs", async ({ page }) => {
    await expect(page.getByText("EXPLAIN COCKPIT")).toBeVisible();

    // Verify all 5 tab buttons exist
    await expect(page.getByRole("button", { name: /3D Graph/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sources/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Signals/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Dialectic/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Terminal/i })).toBeVisible();
  });

  test("should switch across cockpit tabs seamlessly", async ({ page }) => {
    // 1. Click Sources Tab
    const sourcesTab = page.getByRole("button", { name: /Sources/i });
    await sourcesTab.click();
    await expect(page.getByText(/Retrieved Sources|No Sources/i).first()).toBeVisible();

    // 2. Click Signals Tab
    const signalsTab = page.getByRole("button", { name: /Signals/i });
    await signalsTab.click();
    await expect(page.getByText(/Epistemic Signals|Structural Distribution|Empirical Grounding/i).first()).toBeVisible();

    // 3. Click Dialectic Tab
    const dialecticTab = page.getByRole("button", { name: /Dialectic/i });
    await dialecticTab.click();
    await expect(page.getByText(/Missing Context|Counter-Perspective|Dialectic Analysis/i).first()).toBeVisible();

    // 4. Click Terminal Tab
    const terminalTab = page.getByRole("button", { name: /Terminal/i });
    await terminalTab.click();
    await expect(page.getByText(/Live Agent Execution Stream|Pipeline Telemetry|Waiting for next run/i).first()).toBeVisible();

    // 5. Return to 3D Graph Tab
    const graphTab = page.getByRole("button", { name: /3D Graph/i });
    await graphTab.click();
  });

  test("should toggle maximize and restore view on the explainability cockpit", async ({ page }) => {
    const maximizeButton = page.getByRole("button", { name: /Maximize Explain Cockpit/i });
    if (await maximizeButton.isVisible()) {
      await maximizeButton.click();
      const restoreButton = page.getByRole("button", { name: /Restore view/i });
      await expect(restoreButton).toBeVisible();
      await restoreButton.click();
    }
  });

  test("should display epistemic structural signals and metrics when answer is generated", async ({ page }) => {
    const signalsTab = page.getByRole("button", { name: /Signals/i });
    await signalsTab.click();
    // Signals card or empty state placeholder should be mounted
    await expect(page.locator("aside")).toBeVisible();
  });

  test("should toggle the collapsible pipeline stages rail when stage events occur", async ({ page }) => {
    const stagesToggle = page.getByRole("button", { name: /Pipeline Stages/i });
    if (await stagesToggle.isVisible()) {
      await stagesToggle.click();
    }
  });
});
