export async function onRequestGet(context) {
  const key = String(context.params.key || '');
  if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(key)) return new Response('Image introuvable.', { status: 404 });
  const object = await context.env.EVENT_IMAGES.get(key);
  if (!object) return new Response('Image introuvable.', { status: 404 });
  if (context.request.headers.get('if-none-match') === object.httpEtag) return new Response(null, { status: 304, headers: { etag: object.httpEtag } });
  const headers = new Headers({ etag: object.httpEtag, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}
