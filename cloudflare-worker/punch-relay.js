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
 * mirrors the visitor's protocol to the origin, so a plain-HTTP request from the device is
 * forwarded to Vercel as plain HTTP and Vercel answers with a 308 redirect the device will
 * not follow. This Worker breaks that mirroring: it accepts plain HTTP and makes its own
 * fresh HTTPS request to Vercel.
 *
 *     Device --plain HTTP--> Worker --HTTPS--> Vercel --> Firestore
 *
 * Free tier is 100,000 requests/day. The terminal polls every ~16-30 seconds, about
 * 5,000/day, so this stays comfortably inside it.
 */

/** The Vercel deployment. Its own domain, so the request never loops back through here. */
const ORIGIN = 'https://swethacoutures.vercel.app';

/**
 * ── THE CLOCK ──────────────────────────────────────────────────────────────────────────
 *
 * The terminal sets its clock from the HTTP `Date` header on our replies — it polls every
 * ~16 seconds, so this wins over anything typed on the keypad — and then ADDS its own
 * stored timezone to get the time it displays and stamps on punches.
 *
 * This unit is a factory-default **GMT+8** (ZKTeco ships from China) and its menu has no
 * timezone option, so it renders UTC+8: at 12:52 India time it showed 15:22, exactly
 * 2h30m fast. ZKTeco firmware is widely reported not to hold a half-hour zone like +5:30
 * once ADMS is enabled, so the device cannot be fixed from the device.
 *
 * It can be fixed from here. Shifting the `Date` header back by the difference makes the
 * terminal's own arithmetic land on the correct local time:
 *
 *     header (UTC − 2:30)  +  device's +8:00  =  correct India time
 *
 * ⚠️ Set DEVICE_TZ_MINUTES to whatever the terminal actually believes it is, not what you
 * want it to be. If a replacement device shows the right time on its own, set both values
 * equal and the shift becomes zero.
 *
 * This has to live in the Worker, not in the Vercel function: the response below is built
 * from scratch, so any `Date` the origin sets is discarded before the device ever sees it.
 */
const DEVICE_TZ_MINUTES = 480; // what the terminal thinks it is: +8:00
const SHOP_TZ_MINUTES = 330;   // what it should be: +5:30 (India)
const DATE_SHIFT_MINUTES = SHOP_TZ_MINUTES - DEVICE_TZ_MINUTES; // -150

/** Headers every reply carries. The terminal reads the body literally and little else. */
function deviceHeaders() {
  return {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    // The compensated clock. See the block above before changing this.
    Date: new Date(Date.now() + DATE_SHIFT_MINUTES * 60_000).toUTCString(),
    /*
     * Verification marker. Cloudflare stamps its own `Date` on responses, so if the shift
     * above never reaches the device there is no way to tell "the Worker is not deployed"
     * from "the edge overwrote the header" — both look identical from outside. This header
     * is ours alone: if it comes back, the Worker is live and any wrong `Date` is the edge
     * overriding us. The device ignores headers it does not recognise.
     */
    'X-Clock-Shift': String(DATE_SHIFT_MINUTES),
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Only the device's paths are relayed. Anything else gets a plain, honest answer
    // rather than being quietly proxied — this hostname is not a second copy of the site.
    if (!url.pathname.startsWith('/iclock')) {
      return new Response('Fingerprint device endpoint.\n', {
        status: 200,
        headers: deviceHeaders(),
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
      return new Response('OK', { status: 200, headers: deviceHeaders() });
    }

    const body = await response.arrayBuffer();

    return new Response(body, { status: response.status, headers: deviceHeaders() });
  },
};
