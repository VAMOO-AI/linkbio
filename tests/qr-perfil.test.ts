import { describe, expect, test } from "vitest";
import { urlDoQr } from "../lib/qr";

describe("QR de compartilhar", () => {
  test("aponta para a bio com ?src=qr, sem perder o que já tinha", () => {
    expect(urlDoQr("https://bio.exemplo.com")).toBe("https://bio.exemplo.com/?src=qr");
    expect(urlDoQr("https://bio.exemplo.com/")).toBe("https://bio.exemplo.com/?src=qr");
    expect(urlDoQr("https://bio.exemplo.com/?lang=pt")).toBe("https://bio.exemplo.com/?lang=pt&src=qr");
  });
});
