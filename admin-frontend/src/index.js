/**
 * Avnideep Admin Panel - Cloudflare Worker
 * Serves static files using Workers Sites (getAssetFromKV)
 */
import { getAssetFromKV, NotFoundError } from '@cloudflare/kv-asset-handler';

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      try {
        const asset = await getAssetFromKV({
          request,
          waitUntil: (promise) => promise,
        });

        const response = new Response(asset.body, asset);
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('X-XSS-Protection', '1; mode=block');
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

        if (
          pathname.includes('/css/') ||
          pathname.includes('/js/') ||
          pathname.includes('/icons/') ||
          pathname.match(/.(woff2|woff|ttf|jpg|png|svg|ico)$/)
        ) {
          response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        }

        return response;
      } catch (e) {
        if (e instanceof NotFoundError) {
          const indexRequest = new Request(new URL('/index.html', request.url).toString(), request);
          const indexAsset = await getAssetFromKV({
            request: indexRequest,
            waitUntil: (promise) => promise,
          });
          const response = new Response(indexAsset.body, indexAsset);
          response.headers.set('X-Content-Type-Options', 'nosniff');
          response.headers.set('X-Frame-Options', 'DENY');
          response.headers.set('X-XSS-Protection', '1; mode=block');
          response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
          response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
          return response;
        }
        throw e;
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  },
};
