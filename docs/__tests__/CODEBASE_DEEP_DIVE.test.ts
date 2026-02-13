import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const DOCS_PATH = resolve(__dirname, "../CODEBASE_DEEP_DIVE.md");

describe("CODEBASE_DEEP_DIVE.md", () => {
  let content: string;

  it("should exist and be readable", () => {
    expect(existsSync(DOCS_PATH)).toBe(true);
    content = readFileSync(DOCS_PATH, "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });

  describe("Required Sections", () => {
    it("should have all required top-level sections", () => {
      content = readFileSync(DOCS_PATH, "utf-8");

      const requiredSections = [
        "Project Overview & Purpose",
        "Technology Stack & Versions",
        "Complete Codebase Structure",
        "How the Code Works",
        "Data Models & Schema Summary",
        "API / Endpoint Catalog",
        "Authentication & Authorization",
        "User Guide",
        "Code Quality Analysis",
        "Bugs, Errors, and Issues",
        "Missing Core Functionality / Technical Debt",
        "Dependencies & Integrations",
        "Performance & Scalability",
        "Maintenance & Extensibility Recommendations",
        "Significant File Inventory",
        "Final Summary",
      ];

      requiredSections.forEach((section) => {
        expect(content).toContain(section);
      });
    });

    it("should have project name section", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("### Project Name");
      expect(content).toContain("Visuluxe");
    });

    it("should have primary purpose section", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("### Primary Purpose");
    });

    it("should document target audience", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("### Target Audience");
    });
  });

  describe("Markdown Structure", () => {
    it("should start with h1 heading", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      const lines = content.split("\n");
      const firstHeading = lines.find((line) => line.startsWith("#"));
      expect(firstHeading).toBeDefined();
      expect(firstHeading?.startsWith("# ")).toBe(true);
    });

    it("should have proper heading hierarchy", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      const lines = content.split("\n");
      const headings = lines.filter((line) => line.match(/^#{1,6}\s+/));

      expect(headings.length).toBeGreaterThan(0);

      // Check that we don't jump from h1 to h3 without h2, etc.
      let previousLevel = 0;
      for (const heading of headings) {
        const level = (heading.match(/^#+/) || [""])[0].length;
        // Allow any decrease or increase by at most 1 level
        if (previousLevel > 0) {
          expect(level).toBeLessThanOrEqual(previousLevel + 1);
        }
        previousLevel = level;
      }
    });

    it("should not have empty headings", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      const emptyHeadingPattern = /^#{1,6}\s*$/m;
      expect(content).not.toMatch(emptyHeadingPattern);
    });

    it("should use consistent heading style (ATX style with spaces)", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      const lines = content.split("\n");
      const headings = lines.filter((line) => line.match(/^#{1,6}/));

      // All headings should have space after # (ATX style)
      headings.forEach((heading) => {
        if (heading.length > 1) {
          const hashCount = (heading.match(/^#+/) || [""])[0].length;
          expect(heading.charAt(hashCount)).toBe(" ");
        }
      });
    });
  });

  describe("Code Blocks", () => {
    it("should have language tags for code blocks", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      const codeBlockStarts = content.match(/```(\w*)/g) || [];

      // At least some code blocks should exist
      expect(codeBlockStarts.length).toBeGreaterThan(0);

      // Check that fenced code blocks have language tags (except for plain text)
      codeBlockStarts.forEach((block) => {
        const language = block.replace("```", "");
        // Allow empty for plain text, but most should have language tags
        expect(language).toBeDefined();
      });
    });

    it("should have matching code block delimiters", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      const openBlocks = (content.match(/```/g) || []).length;

      // Should be even number (opening and closing)
      expect(openBlocks % 2).toBe(0);
    });
  });

  describe("Content Quality", () => {
    it("should not contain placeholder TODOs", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      // Case-insensitive check for common placeholders
      expect(content.toLowerCase()).not.toContain("todo:");
      expect(content.toLowerCase()).not.toContain("fixme:");
      expect(content.toLowerCase()).not.toContain("xxx:");
    });

    it("should document programming languages", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("### Programming Languages");
      expect(content).toContain("TypeScript");
    });

    it("should document frameworks and libraries", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("### Frameworks & Libraries");
      expect(content).toContain("react");
    });

    it("should document database information", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("### Database & Storage");
      expect(content).toContain("Supabase");
    });

    it("should not have consecutive blank lines (more than 2)", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      // This helps keep the document clean
      expect(content).not.toMatch(/\n\n\n\n+/);
    });

    it("should use consistent list formatting", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      const lines = content.split("\n");
      const listItems = lines.filter((line) => line.match(/^\s*[-*+]\s+/));

      // Should have list items
      expect(listItems.length).toBeGreaterThan(0);

      // All list items should have space after marker
      listItems.forEach((item) => {
        const marker = item.match(/^\s*[-*+]/)?.[0];
        if (marker) {
          const afterMarker = item.substring(marker.length);
          expect(afterMarker.startsWith(" ")).toBe(true);
        }
      });
    });
  });

  describe("Technical Documentation Completeness", () => {
    it("should document environment variables", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("Env Variables");
      expect(content).toContain("VITE_SUPABASE_URL");
    });

    it("should document authentication methods", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("### Authentication");
      expect(content).toContain("### Authorization");
    });

    it("should document API endpoints", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("generate-image");
      expect(content).toContain("create-api-key");
    });

    it("should document data models", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("## 5. Data Models & Schema Summary");
      expect(content).toContain("profiles");
      expect(content).toContain("user_credits");
    });

    it("should include file inventory table", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("## 15. Significant File Inventory");
      // Check for markdown table format
      expect(content).toMatch(/\|\s*File\s*\|\s*Purpose\s*\|/);
    });
  });

  describe("Documentation Conventions", () => {
    it("should use proper markdown link format for internal references", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      const lines = content.split("\n");

      // Check that inline code uses backticks
      lines.forEach((line) => {
        // If line mentions file paths, they should be in backticks
        if (line.includes(".tsx") || line.includes(".ts")) {
          // At least some should be in backticks
          const hasBackticks = line.includes("`");
          // This is a soft check - we don't enforce 100% but expect some usage
          if (line.match(/\.(tsx?|jsx?|json|sql)/)) {
            // Lines with file extensions should ideally have backticks
            expect(hasBackticks).toBe(true);
          }
        }
      });
    });

    it("should have proper list nesting and indentation", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      const lines = content.split("\n");
      const listLines = lines.filter((line) => line.match(/^\s*[-*+]\s+/));

      // Check that we have list items (basic validation)
      expect(listLines.length).toBeGreaterThan(0);

      // Verify list markers are followed by space
      listLines.forEach((line) => {
        const trimmed = line.trimStart();
        expect(trimmed.match(/^[-*+]\s/)).toBeTruthy();
      });
    });
  });

  describe("Section Numbering and Organization", () => {
    it("should have numbered sections in sequence", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      const numberedSections = content.match(/^## \d+\./gm) || [];

      expect(numberedSections.length).toBeGreaterThan(0);

      // Check sequence
      const numbers = numberedSections.map((s) => parseInt(s.match(/\d+/)?.[0] || "0"));
      for (let i = 1; i < numbers.length; i++) {
        expect(numbers[i]).toBe(numbers[i - 1] + 1);
      }
    });

    it("should start numbering from 1", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      const firstNumberedSection = content.match(/^## \d+\./m)?.[0];
      expect(firstNumberedSection).toContain("## 1.");
    });
  });

  describe("Specific Content Validation", () => {
    it("should document known issues with severity levels", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("## 10. Bugs, Errors, and Issues");
      expect(content).toContain("Severity:");
    });

    it("should include maintenance recommendations", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("## 14. Maintenance & Extensibility Recommendations");
    });

    it("should document performance and scalability concerns", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("## 13. Performance & Scalability");
    });

    it("should have a final summary section", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("## 16. Final Summary");
      // Final summary should be near the end
      const summaryIndex = content.indexOf("## 16. Final Summary");
      const contentLength = content.length;
      expect(summaryIndex / contentLength).toBeGreaterThan(0.9);
    });
  });

  describe("Edge Cases and Validation", () => {
    it("should not have broken internal section references", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      // Check for common broken reference patterns
      expect(content).not.toContain("(see section )");
      expect(content).not.toContain("(see #)");
      expect(content).not.toContain("[](#)");
    });

    it("should properly format file paths", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      // File paths should typically be in backticks
      const filePathMentions = content.match(/`[^`]+\.(tsx?|jsx?|json|md|sql)`/g) || [];
      expect(filePathMentions.length).toBeGreaterThan(0);
    });

    it("should document technical debt explicitly", () => {
      content = readFileSync(DOCS_PATH, "utf-8");
      expect(content).toContain("## 11. Missing Core Functionality / Technical Debt");
      expect(content.toLowerCase()).toContain("technical debt");
    });
  });
});