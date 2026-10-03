// Minimal Web Push sender built on WebCrypto: payload encryption (RFC 8291,
// aes128gcm) and VAPID authentication (RFC 8292). No dependencies, so it runs
// in a Worker as-is.

export interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface VapidKeys {
  publicKey: string   // base64url, uncompressed P-256 point (65 bytes)
  privateKey: JsonWebKey
}

const encoder = new TextEncoder()

export function base64UrlEncode(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of array) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
  return new Uint8Array(bits)
}

export async function generateVapidKeys(): Promise<VapidKeys> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  )) as CryptoKeyPair
  const publicKey = (await crypto.subtle.exportKey('raw', keyPair.publicKey)) as ArrayBuffer
  const privateKey = (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey
  return { publicKey: base64UrlEncode(publicKey), privateKey }
}

async function vapidAuthorization(endpoint: string, vapid: VapidKeys, subject: string) {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = base64UrlEncode(encoder.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  })))
  const unsigned = `${header}.${claims}`
  const key = await crypto.subtle.importKey('jwk', vapid.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  // WebCrypto returns the raw r||s signature that JWS ES256 expects
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned))
  return `vapid t=${unsigned}.${base64UrlEncode(signature)}, k=${vapid.publicKey}`
}

/** Encrypts a payload for one subscription (RFC 8291 aes128gcm, single record) */
export async function encryptPayload(subscription: PushSubscriptionJSON, payload: string) {
  const uaPublic = base64UrlDecode(subscription.keys.p256dh)
  const authSecret = base64UrlDecode(subscription.keys.auth)

  // Ephemeral application-server key pair for this message
  const local = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', local.publicKey)) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  // The standard field is `public`; workers-types spells it `$public`
  const ecdhParams = { name: 'ECDH', public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(ecdhParams, local.privateKey, 256))

  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)

  // Single record: payload followed by the 0x02 last-record delimiter
  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]))
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext))

  // Header: salt(16) | record size(4) | key id length(1) | key id (our public key)
  const recordSize = new Uint8Array(4)
  new DataView(recordSize.buffer).setUint32(0, 4096)
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext)
}

export interface SendOptions {
  vapid: VapidKeys
  subject: string   // contact for the push service: a mailto: or https: URL
  ttl?: number      // seconds the push service may hold the message
  topic?: string    // a newer message with the same topic replaces an undelivered one
}

/** Sends one push message; returns the push service's HTTP status */
export async function sendPush(subscription: PushSubscriptionJSON, payload: string, options: SendOptions) {
  const body = await encryptPayload(subscription, payload)
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(subscription.endpoint, options.vapid, options.subject),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(options.ttl ?? 3600),
    Urgency: 'high',
  }
  if (options.topic) headers.Topic = options.topic
  const res = await fetch(subscription.endpoint, { method: 'POST', headers, body })
  return res.status
}
