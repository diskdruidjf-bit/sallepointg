import { imageUploadInfo, json, logError, requireAdmin } from '../../_lib.js';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context); if (auth.error) return auth.error;
    const declaredSize = Number(context.request.headers.get('content-length') || 0);
    if (declaredSize > MAX_IMAGE_SIZE) return json({ error: 'L’image dépasse la limite de 8 Mo.' }, 413);
    const buffer = await context.request.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > MAX_IMAGE_SIZE) return json({ error: 'L’image est vide ou dépasse la limite de 8 Mo.' }, 413);
    const bytes = new Uint8Array(buffer);
    const { contentType, extension } = imageUploadInfo(bytes, context.request.headers.get('content-type'));
    const key = `${crypto.randomUUID()}.${extension}`;
    await context.env.EVENT_IMAGES.put(key, buffer, { httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } });
    return json({ url: `/media/${key}` }, 201);
  } catch (error) {
    logError(error, context.request);
    return json({ error: error instanceof Error ? error.message : 'Téléversement impossible.' }, 400);
  }
}
