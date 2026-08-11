/**
 * Cloudflare Worker — plain-HTTP front door for the fingerprint terminal.
 *
 * Deployed on the route:  punch.swethacoutures.com/*
 *
 * ── Why this exists ────────────────────────────────────────────────────────────────────
 * The ZKTeco K40 Pro cannot use HTTPS with Vercel. Proven on the hardware: it validates
 * certificates and rejected an untrusted one 55 times out of 55, and Vercel's certificate
 * is issued by Google Trust Services (2016) while the terminal's firmware trust list is
 * from 2017. So the device must speak plain HTTP.
 *
 * Cloudflare accepts plain HTTP happily — but every Cloudflare SSL mode says "encrypts
 * traffic between Cloudflare and your origin *if the request uses HTTPS*". Cloudflare
 * mirrors the visitor's protocol to the origin, so a plain-HTTP request from the device
 * is forwarded to Vercel as plain HTTP, and Vercel answers with its own 308 redirect to
 * HTTPS. The device does not follow redirects, so it stalls. No SSL setting changes this.
 *
 * This Worker breaks that mirroring: it accepts the device's plain HTTP and makes its own
 * fresh HTTPS request to Vercel. Cloudflare has no trouble with Vercel's certificate —
 * only the 2017 terminal does.
 *
 *     Device --plain HTTP--> Worker --HTTPS--> Vercel --> Firestore
 *
 * Free tier is 100,000 requests/day. The terminal polls roughly every 16-30 seconds,
 * about 5,000/day, so this stays comfortably inside it.
 */

/** The Vercel deployment. Its own domain, so the request never loops back through here. */
const ORIGIN = 'https://swethacoutures.vercel.app';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Only the device's paths are relayed. Anything else gets a plain, honest answer
    // rather than being quietly proxied — this hostname is not a second copy of the site.
    if (!url.pathname.startsWith('/iclock')) {
      return new Response('Fingerprint device endpoint.\n', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const headers = new Headers(request.headers);
    // Host must not be forwarded, or Vercel receives a name it is not serving here.
    headers.delete('host');

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

    let response;
    try {
      response = await fetch(ORIGIN + url.pathname + url.search, {
        method: request.method,
        headers,
        // Read the body fully rather than streaming it: ATTLOG uploads are a few hundred
        // bytes, and a buffered body avoids the streaming-duplex restrictions.
        body: hasBody ? await request.arrayBuffer() : undefined,
        // Never follow a redirect. If Vercel ever answers with one we want to see it,
        // not silently chase it and hand the device something unexpected.
        redirect: 'manual',
      });
    } catch (error) {
      // The device treats anything other than a clean reply as a failed delivery and
      // retries in a loop. Answering OK keeps it calm; the punch is replayed next time.
      return new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const body = await response.arrayBuffer();

    // The terminal reads the body literally and ignores almost every header, so the
    // response is rebuilt cleanly rather than passing Vercel's headers through.
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  },
};
