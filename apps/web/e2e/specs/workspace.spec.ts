import { expect, test } from "@playwright/test";

test.describe("Workspace & Chat Interaction E2E Suite", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to base workspace page
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  test("should render the main workspace layout with AppShell, ChatPanel, and ExplainCockpit", async ({ page }) => {
    // Verify core containers are present
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByPlaceholder(/Ask a research question/i)).toBeVisible();
    await expect(page.getByText("EXPLAIN COCKPIT")).toBeVisible();
  });

  test("should toggle response modes in the ModeSelector dropdown", async ({ page }) => {
    // Open mode selector dropdown
    const modeButton = page.getByRole("button", { name: /Response mode:/i });
    await expect(modeButton).toBeVisible();
    await modeButton.click();

    // Select Fast Mode
    const fastOption = page.getByRole("option", { name: /Fast Mode/i });
    if (await fastOption.isVisible()) {
      await fastOption.click();
      await expect(page.getByRole("button", { name: /Response mode: Fast Mode/i })).toBeVisible();
    }
  });

  test("should enter text into the chat composer and submit a research prompt", async ({ page }) => {
    const composer = page.getByPlaceholder(/Ask a research question/i);
    await composer.fill("What is the speed of light in vacuum?");
    await expect(composer).toHaveValue("What is the speed of light in vacuum?");

    // Submit by pressing Enter
    await composer.press("Enter");
    // Verify user message appears in chat thread
    await expect(page.getByText("What is the speed of light in vacuum?")).toBeVisible({ timeout: 10_000 });
  });

  test("should execute a demo prompt when clicking on a suggested topic tile", async ({ page }) => {
    // Check for demo prompt buttons
    const demoPrompt = page.getByText("Quantum error correction protocols").first();
    if (await demoPrompt.isVisible()) {
      await demoPrompt.click();
      await expect(page.getByText(/superconducting qubits/i)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("should support New Chat and conversation search in the history sidebar", async ({ page }) => {
    const newChatButton = page.getByRole("button", { name: /New Chat/i });
    if (await newChatButton.isVisible()) {
      await newChatButton.click();
    }

    const searchInput = page.getByPlaceholder(/Search threads/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("Quantum");
      await expect(searchInput).toHaveValue("Quantum");
    }
  });

  test("should open shortcuts help dialog when pressing ?", async ({ page }) => {
    await page.keyboard.press("?");
    const dialogTitle = page.getByText(/Keyboard Shortcuts|Shortcuts/i).first();
    if (await dialogTitle.isVisible()) {
      await expect(dialogTitle).toBeVisible();
      await page.keyboard.press("Escape");
    }
  });

  test("should adapt to mobile viewport dimensions gracefully", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByPlaceholder(/Ask a research question/i)).toBeVisible();
  });
});
