// LAN static previews use HTTP. Route those bytes into an isolated HTTPS test
// origin so Chromium can exercise Web Locks. Public HTTPS runs use the real URL.
// This is test-only request routing, not evidence of a preview TLS certificate.
export async function browserOrigin(context, baseUrl) {
  if (new URL(baseUrl).protocol === "https:") return baseUrl;
  const origin = "https://loa-preview.test/";
  await context.route(`${origin}**`, async (route) => {
    const request = new URL(route.request().url());
    const response = await context.request.get(new URL(request.pathname.slice(1) + request.search, baseUrl).href);
    await route.fulfill({ response });
  });
  return origin;
}
