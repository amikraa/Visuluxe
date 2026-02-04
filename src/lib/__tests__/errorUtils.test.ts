import { describe, expect, it } from "vitest";
import { getSafeErrorMessage } from "@/lib/errorUtils";

describe("getSafeErrorMessage", () => {
  it("maps known error codes to friendly messages", () => {
    const message = getSafeErrorMessage({ code: "23505" });
    expect(message).toBe("This username is already taken. Please choose a different one.");
  });

  it("redacts sensitive database details", () => {
    const message = getSafeErrorMessage({
      message: "duplicate key value violates unique constraint on table public.users",
    });
    expect(message).toBe("An error occurred. Please try again.");
  });

  it("redacts token or stack trace details", () => {
    const message = getSafeErrorMessage({
      message: "JWT token leaked. stack: Error: at doThing (file.ts:1:1)",
    });
    expect(message).toBe("An error occurred. Please try again.");
  });

  it("passes through safe, user-friendly messages", () => {
    const message = getSafeErrorMessage({
      message: "Please upload a JPG or PNG file.",
    });
    expect(message).toBe("Please upload a JPG or PNG file.");
  });
});
