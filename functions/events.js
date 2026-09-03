export function onRequest(context) {
  if (!['GET', 'HEAD'].includes(context.request.method)) {
    return new Response('Méthode refusée.', { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  return new Response(null, {
    status: 301,
    headers: {
      location: '/evenements',
      'cache-control': 'no-store'
    }
  });
}
