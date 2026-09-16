import crypto from 'crypto';

export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignature = parts[1];
  if (!expectedSignature) {
    return false;
  }
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const calculatedSignature = hmac.digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const calculatedBuffer = Buffer.from(calculatedSignature, 'utf8');

  if (expectedBuffer.length !== calculatedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
}
