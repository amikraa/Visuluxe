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