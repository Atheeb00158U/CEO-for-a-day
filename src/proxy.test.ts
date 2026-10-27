// Next 16.4.1 still exports the old name; the docs call it unstable_doesProxyMatch.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { adminAccess, config, proxy } from "./proxy";

const basic = (userPass: string) => "Basic " + Buffer.from(userPass).toString("base64");

describe("adminAccess", () => {
  const pw = "correct horse";
  it("lets the right password through, with any username", () => {
    expect(adminAccess(basic("atheeb:correct horse"), pw, "production")).toBe("ok");
    expect(adminAccess(basic(":correct horse"), pw, "production")).toBe("ok");
  });

  it("refuses wrong, wrong-length, missing and malformed credentials", () => {
    expect(adminAccess(basic("a:correct hors3"), pw, "production")).toBe("denied");
    expect(adminAccess(basic("a:x"), pw, "production")).toBe("denied");
    expect(adminAccess(null, pw, "production")).toBe("denied");
    expect(adminAccess("Bearer abc", pw, "production")).toBe("denied");
    expect(adminAccess(basic("no-colon"), pw, "production")).toBe("denied");
    expect(adminAccess("Basic", pw, "production")).toBe("denied");
  });

  it("is open in dev but closed elsewhere when no password is set", () => {
    expect(adminAccess(null, undefined, "development")).toBe("ok");
    expect(adminAccess(null, undefined, "production")).toBe("unset");
    expect(adminAccess(null, "", "test")).toBe("unset");
  });
});

describe("proxy", () => {
  it("only runs on /admin", () => {
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });
    expect(matches("/admin")).toBe(true);
    expect(matches("/admin/kodak")).toBe(true);
    expect(matches("/app")).toBe(false);
    expect(matches("/")).toBe(false);
    expect(matches("/administrator")).toBe(false);
  });

  it("asks the browser for a password and keeps the response private", () => {
    process.env.ADMIN_PASSWORD = "pw";
    try {
      const denied = proxy(new NextRequest("https://example.com/admin"));
      expect(denied.status).toBe(401);
      expect(denied.headers.get("www-authenticate")).toMatch(/^Basic realm=/);
      expect(denied.headers.get("cache-control")).toBe("private, no-store");

      const ok = proxy(new NextRequest("https://example.com/admin", { headers: { authorization: basic("x:pw") } }));
      expect(ok.status).toBe(200);
      expect(ok.headers.get("x-robots-tag")).toBe("noindex");
    } finally {
      delete process.env.ADMIN_PASSWORD;
    }
  });
});
