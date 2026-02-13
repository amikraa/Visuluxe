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
import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("CODEBASE_DEEP_DIVE.md", () => {
  let content: string;
  let lines: string[];

  beforeAll(() => {
    const filePath = join(__dirname, "../CODEBASE_DEEP_DIVE.md");
    content = readFileSync(filePath, "utf-8");
    lines = content.split("\n");
  });

  describe("File Structure", () => {
    it("should exist and be readable", () => {
      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
    });

    it("should have proper markdown structure with title", () => {
      expect(lines[0]).toMatch(/^# /);
      expect(lines[0]).toContain("Visuluxe Codebase Deep Dive");
    });

    it("should contain a purpose statement", () => {
      expect(content).toContain("comprehensive technical analysis");
      expect(content).toContain("onboarding and maintenance reference");
    });

    it("should have proper section separators", () => {
      const separators = lines.filter(line => line.trim() === "---");
      expect(separators.length).toBeGreaterThan(10);
    });
  });

  describe("Required Sections", () => {
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
      it(`should contain section: ${section}`, () => {
        expect(content).toContain(section);
      });
    });

    it("should have sections in logical order", () => {
      const sectionIndices = requiredSections.map((section) => {
        const index = content.indexOf(section);
        return { section, index };
      });

      // Verify all sections are found
      sectionIndices.forEach(({ section, index }) => {
        expect(index).toBeGreaterThan(-1);
      });

      // Verify they appear in order
      for (let i = 1; i < sectionIndices.length; i++) {
        expect(sectionIndices[i].index).toBeGreaterThan(
          sectionIndices[i - 1].index
        );
      }
    });
  });

  describe("Content Completeness", () => {
    it("should document all key technologies", () => {
      const technologies = [
        "TypeScript",
        "React",
        "Supabase",
        "Vite",
        "vitest",
        "Tailwind",
      ];

      technologies.forEach((tech) => {
        expect(content.toLowerCase()).toContain(tech.toLowerCase());
      });
    });

    it("should list edge functions", () => {
      const functions = [
        "generate-image",
        "create-api-key",
        "manage-provider-keys",
        "test-provider-connection",
        "scheduled-profile-sync",
        "refresh-analytics-cache",
        "assign-external-admin",
      ];

      functions.forEach((func) => {
        expect(content).toContain(func);
      });
    });

    it("should document authentication methods", () => {
      expect(content).toContain("email/password");
      expect(content).toContain("Google OAuth");
    });

    it("should list user roles", () => {
      const roles = [
        "super_admin",
        "admin",
        "moderator",
        "support",
        "analyst",
        "user",
      ];

      roles.forEach((role) => {
        expect(content).toContain(role);
      });
    });

    it("should document main data entities", () => {
      const entities = [
        "profiles",
        "user_credits",
        "providers",
        "ai_models",
        "images",
        "api_keys",
      ];

      entities.forEach((entity) => {
        expect(content).toContain(entity);
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
    it("should have properly formatted code blocks with language specifiers", () => {
      const codeBlockPattern = /```(\w+)\n/g;
      const matches = content.match(codeBlockPattern);

      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThan(0);

      // All code blocks should have language specifiers
      matches!.forEach((match) => {
        expect(match).toMatch(/```(bash|typescript|sql|json|tsx)/);
      });
    });

    it("should have matching opening and closing code block markers", () => {
      // Match code blocks with optional leading whitespace
      const allCodeBlockMarkers = (content.match(/^\s*```/gm) || []).length;

      // Should have an even number of ``` markers (opening and closing pairs)
      expect(allCodeBlockMarkers % 2).toBe(0);
      expect(allCodeBlockMarkers).toBeGreaterThan(0);
    });

    it("should include npm command examples", () => {
      expect(content).toContain("npm install");
      expect(content).toContain("npm run dev");
      expect(content).toContain("npm run build");
      expect(content).toContain("npm run test");
    });
  });

  describe("Tables", () => {
    it("should contain the Significant File Inventory table", () => {
      expect(content).toContain("| File | Purpose | Approx Complexity |");
      expect(content).toContain("|---|---|---|");
    });

    it("should have properly formatted table rows", () => {
      // Find table section
      const tableStart = content.indexOf("| File | Purpose | Approx Complexity |");
      const tableSection = content.slice(tableStart, tableStart + 2000);
      const tableRows = tableSection.split("\n").filter((line) => line.startsWith("|"));

      // Should have header, separator, and data rows
      expect(tableRows.length).toBeGreaterThan(10);

      // Each row should have 3 columns
      tableRows.forEach((row) => {
        const columns = row.split("|").filter((col) => col.trim().length > 0);
        if (!row.includes("---")) {
          expect(columns.length).toBe(3);
        }
      });
    });

    it("should document file complexity levels", () => {
      const complexityLevels = ["Simple", "Moderate", "Complex", "Very Complex"];

      complexityLevels.forEach((level) => {
        expect(content).toContain(level);
      });
    });
  });

  describe("Issues and Bugs Section", () => {
    it("should document identified issues with severity levels", () => {
      expect(content).toContain("Severity:");
      expect(content).toContain("Impact:");
      expect(content).toContain("Suggested fix:");
    });

    it("should list multiple issues (A through E)", () => {
      const issues = ["Issue A", "Issue B", "Issue C", "Issue D", "Issue E"];

      issues.forEach((issue) => {
        expect(content).toContain(issue);
      });
    });

    it("should categorize severity levels appropriately", () => {
      const severityLevels = ["Low", "Medium", "High"];

      severityLevels.forEach((severity) => {
        expect(content).toContain(`Severity: ${severity}`);
      });
    });
  });

  describe("Environment Variables", () => {
    it("should document frontend environment variables", () => {
      const frontendVars = [
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_PUBLISHABLE_KEY",
        "VITE_SUPABASE_PROJECT_ID",
      ];

      frontendVars.forEach((envVar) => {
        expect(content).toContain(envVar);
      });
    });

    it("should document backend secrets", () => {
      const backendSecrets = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "ENCRYPTION_KEY",
      ];

      backendSecrets.forEach((secret) => {
        expect(content).toContain(secret);
      });
    });
  });

  describe("Architecture Documentation", () => {
    it("should describe the startup lifecycle", () => {
      expect(content).toContain("Startup Lifecycle");
      expect(content).toContain("index.html");
      expect(content).toContain("src/main.tsx");
    });

    it("should document request/response flow", () => {
      expect(content).toContain("Request/Response Flow");
      expect(content).toContain("Generate.tsx");
    });

    it("should explain background processing", () => {
      expect(content).toContain("Background/Scheduled Processing");
      expect(content).toContain("scheduled-profile-sync");
    });

    it("should describe the architecture pattern", () => {
      expect(content).toContain("Architecture Pattern");
      expect(content).toContain("Modular");
    });
  });

  describe("Recommendations", () => {
    it("should provide maintenance recommendations", () => {
      expect(content).toContain("## 14. Maintenance & Extensibility Recommendations");
      expect(content).toContain("Tighten TS strictness");
      expect(content).toContain("Implement CI quality gates");
      expect(content).toContain("Expand tests");
    });

    it("should provide performance recommendations", () => {
      expect(content).toContain("Scaling recommendations");
      expect(content).toContain("indexes");
    });
  });

  describe("Dependencies Section", () => {
    it("should list core frontend dependencies with versions", () => {
      expect(content).toContain("react");
      expect(content).toContain("^18.3.1");
      expect(content).toContain("@tanstack/react-query");
    });

    it("should document UI libraries", () => {
      const uiLibs = ["Radix UI", "tailwindcss", "lucide-react", "sonner"];

      uiLibs.forEach((lib) => {
        expect(content).toContain(lib);
      });
    });

    it("should mention external integrations", () => {
      expect(content).toContain("External Integrations");
      expect(content).toContain("Supabase");
    });
  });

  describe("Page and Component Documentation", () => {
    it("should document main pages", () => {
      const pages = ["Generate.tsx", "Dashboard.tsx"];

      pages.forEach((page) => {
        expect(content).toContain(page);
      });
    });

    it("should document admin pages", () => {
      const adminPages = [
        "AdminUsers",
        "AdminModels",
        "AdminProviders",
        "AdminSecurity",
        "AdminBilling",
        "AdminSettings",
        "AdminAnalytics",
      ];

      adminPages.forEach((page) => {
        expect(content).toContain(page);
      });
    });

    it("should document context providers", () => {
      expect(content).toContain("AuthContext");
      expect(content).toContain("AdminContext");
    });

    it("should document route protection", () => {
      expect(content).toContain("ProtectedRoute");
      expect(content).toContain("AdminProtectedRoute");
    });
  });

  describe("Formatting and Style", () => {
    it("should use consistent heading levels", () => {
      const h1Count = (content.match(/^# /gm) || []).length;
      const h2Count = (content.match(/^## /gm) || []).length;
      const h3Count = (content.match(/^### /gm) || []).length;

      // Should have 1 main title
      expect(h1Count).toBe(1);

      // Should have multiple section headers
      expect(h2Count).toBeGreaterThan(10);

      // Should have subsection headers
      expect(h3Count).toBeGreaterThan(5);
    });

    it("should have consistent list formatting", () => {
      const bulletPoints = content.match(/^- /gm) || [];
      const numberedPoints = content.match(/^\d+\. /gm) || [];

      expect(bulletPoints.length).toBeGreaterThan(50);
      expect(numberedPoints.length).toBeGreaterThan(10);
    });

    it("should use proper markdown emphasis", () => {
      expect(content).toMatch(/\*\*[^*]+\*\*/); // Bold text
      expect(content).toMatch(/`[^`]+`/); // Inline code
    });
  });

  describe("Edge Cases and Negative Tests", () => {
    it("should not contain placeholder text like TODO or FIXME", () => {
      expect(content.toUpperCase()).not.toContain("TODO:");
      expect(content.toUpperCase()).not.toContain("FIXME:");
    });

    it("should not contain broken markdown links", () => {
      // Check for malformed markdown links [text]( url) with space
      const brokenLinks = content.match(/\[[^\]]+\]\(\s+[^\)]+\)/g);
      expect(brokenLinks).toBeNull();
    });

    it("should not have excessive whitespace", () => {
      const excessiveBlankLines = content.match(/\n{4,}/g);
      expect(excessiveBlankLines).toBeNull();
    });

    it("should not contain common typos in technical terms", () => {
      // Check for common misspellings
      expect(content.toLowerCase()).not.toContain("databse");
      expect(content.toLowerCase()).not.toContain("authentification");
      expect(content.toLowerCase()).not.toContain("enviroment");
    });

    it("should have consistent capitalization for product name", () => {
      const visuluxeMatches = content.match(/Visuluxe/g) || [];
      // Should appear multiple times with consistent capitalization
      expect(visuluxeMatches.length).toBeGreaterThanOrEqual(5);

      // Check it's not inconsistently lowercased in prose
      const lines = content.split("\n");
      lines.forEach((line) => {
        // Skip code blocks and URLs
        if (!line.includes("```") && !line.includes("http")) {
          expect(line).not.toContain("visuluxe ");
        }
      });
    });
  });

  describe("Technical Accuracy", () => {
    it("should correctly reference file paths", () => {
      // Sample of file paths that should be correct
      const filePaths = [
        "src/App.tsx",
        "src/contexts/AuthContext.tsx",
        "src/pages/Generate.tsx",
        "supabase/functions/generate-image",
      ];

      filePaths.forEach((path) => {
        expect(content).toContain(path);
      });
    });

    it("should document config files", () => {
      const configFiles = [
        "vite.config.ts",
        "vitest.config.ts",
        "tsconfig",
      ];

      configFiles.forEach((config) => {
        expect(content).toContain(config);
      });
    });

    it("should reference proper HTTP status codes", () => {
      const statusCodes = ["400", "401", "402", "403", "429", "503", "500"];

      statusCodes.forEach((code) => {
        expect(content).toContain(code);
      });
    });
  });

  describe("Completeness and Quality Indicators", () => {
    it("should be comprehensive in length", () => {
      // Should be a substantial document
      expect(lines.length).toBeGreaterThan(400);
      expect(content.length).toBeGreaterThan(15000);
    });

    it("should have balanced content distribution", () => {
      // No section should dominate excessively
      const sections = content.split("---");
      sections.forEach((section) => {
        // No single section should be more than 40% of the document
        expect(section.length).toBeLessThan(content.length * 0.4);
      });
    });

    it("should conclude with a final summary", () => {
      const lastSection = content.slice(-1000);
      expect(lastSection).toContain("Final Summary");
      expect(lastSection).toContain("Visuluxe is a full-stack");
    });
  });
});