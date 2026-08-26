export function onRequest(context) {
  if (!['GET', 'HEAD'].includes(context.request.method)) return new Response('Méthode refusée.', { status: 405, headers: { allow: 'GET, HEAD' } });
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = '/event';
  return context.env.ASSETS.fetch(new Request(assetUrl, context.request));
}
