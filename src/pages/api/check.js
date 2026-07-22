// This route needs to run per-request (it fetches an external URL live),
// so it's opted out of static prerendering.
export const prerender = false;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

export async function GET({ url }) {
  let queryUrl = url.searchParams.get('url');

  if (!queryUrl) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing url parameter' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Normalize URL — strip protocol and paths to get domain
  try {
    queryUrl = queryUrl.replace(/^https?:\/\//, '').split('/')[0];
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid URL format' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!queryUrl || queryUrl.trim() === '') {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid URL format' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const targetUrl = `https://${queryUrl}/.well-known/ucp`;
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'UCP-Compliance-Checker/1.0',
      },
    });

    clearTimeout(timeoutId);

    const timing = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    let data = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        // Not valid JSON — leave data as null, raw text is still returned below
      }
    }

    const headersObj = {};
    for (const [key, value] of response.headers.entries()) {
      headersObj[key] = value;
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        url: targetUrl,
        status: response.status,
        contentType,
        headers: headersObj,
        data,
        raw: rawText,
        https: true,
        error: response.ok ? null : `HTTP Error ${response.status}`,
        timing,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    clearTimeout(timeoutId);
    const timing = Date.now() - startTime;

    let errorMessage = error.message;
    if (error.name === 'AbortError') {
      errorMessage = 'Request timed out after 10 seconds';
    }

    return new Response(
      JSON.stringify({
        success: false,
        url: targetUrl,
        status: null,
        contentType: null,
        headers: {},
        data: null,
        raw: null,
        https: true,
        error: errorMessage,
        timing,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}
