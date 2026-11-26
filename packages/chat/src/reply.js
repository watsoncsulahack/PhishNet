/** Structured agent claims, never merchant verification or payment authorization. */
export const REPLY_VERSION = 'phishnet.chat-reply.v1';
const key = /^[A-Za-z0-9:._-]{1,160}$/;
function object(value, allowed, required = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)) || required.some(k => value[k] === undefined)) throw Error('Unexpected or missing chat reply fields.');
}
function text(value, limit, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw Error(`Invalid ${name}.`);
}
export function safeProductURL(value) {
  if (typeof value !== 'string' || value.length > 2048) throw Error('Invalid product link.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Product links must use HTTPS without embedded credentials.');
  return url.href;
}
export function assertReply(reply) {
  object(reply, ['version', 'text', 'items'], ['version', 'text', 'items']);
  if (reply.version !== REPLY_VERSION || typeof reply.text !== 'string' || reply.text.length > 8000 || !Array.isArray(reply.items) || reply.items.length > 6 || (!reply.text.trim() && !reply.items.length)) throw Error('Invalid chat response.');
  const ids = new Set();
  for (const item of reply.items) {
    object(item, ['id', 'title', 'description', 'merchant', 'url', 'imageDataUrl', 'price', 'features', 'proposalId'], ['id', 'title']);
    if (typeof item.id !== 'string' || !key.test(item.id) || ids.has(item.id)) throw Error('Item IDs must be unique.');
    ids.add(item.id);text(item.title, 160, 'item title');
    if (item.description !== undefined) text(item.description, 1600, 'item description');
    if (item.merchant !== undefined) text(item.merchant, 120, 'merchant assertion');
    if (item.url !== undefined) safeProductURL(item.url);
    if (item.imageDataUrl !== undefined && (typeof item.imageDataUrl !== 'string' || item.imageDataUrl.length > 8192 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(item.imageDataUrl))) throw Error('Only small embedded PNG, JPEG or WebP item images are supported.');
    if (item.price !== undefined) {
      object(item.price, ['amount', 'currency'], ['amount', 'currency']);
      if (typeof item.price.amount !== 'string' || !/^(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$/.test(item.price.amount) || !/^[A-Z]{3}$/.test(item.price.currency)) throw Error('Invalid agent-reported price.');
    }
    if (item.features !== undefined && (!Array.isArray(item.features) || item.features.length > 6 || item.features.some(f => typeof f !== 'string' || !f.trim() || f.length > 180))) throw Error('Invalid item features.');
    if (item.proposalId !== undefined && (typeof item.proposalId !== 'string' || !key.test(item.proposalId))) throw Error('Invalid proposal reference.');
  }
  if (new TextEncoder().encode(JSON.stringify(reply)).length > 32000) throw Error('Chat response exceeds 32KB.');
  return reply;
}
