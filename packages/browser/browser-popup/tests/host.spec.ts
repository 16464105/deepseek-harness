/**
 * Unit coverage for the browser-popup Host surface: the byte-safe base64
 * encoder (regression for the UTF-8 double-encoding bug) and the Remote
 * service answers against a fake browser controller. No Playwright browser
 * runs here.
 */

import { describe, expect, it } from 'vitest'
import { bytesToBase64 } from '../src/index.ts'

/** Minimal PNG header bytes: 8-byte signature + IHDR chunk start. */
const PNG_HEAD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])

/** A full 1280x720 PNG from the real browser has bytes >= 0x80 throughout; emulate one. */
function pngishBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) bytes[i] = (i * 131 + 89) & 0xff
  return bytes
}

describe('bytesToBase64', () => {
  it('encodes a PNG header to the canonical iVBORw0KGgo prefix', () => {
    const b64 = bytesToBase64(PNG_HEAD)
    expect(b64.slice(0, 16)).toBe('iVBORw0KGgoAAAAN')
  })

  it('is byte-safe: bytes >= 0x80 do not get UTF-8 double-encoded', () => {
    const bytes = pngishBytes(1024)
    const b64 = bytesToBase64(bytes)
    // Round-trip through standard atob: every decoded byte must match.
    const bin = atob(b64)
    const decoded = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) decoded[i] = bin.charCodeAt(i)
    expect(decoded).toEqual(bytes)
  })

  it('pads short inputs correctly', () => {
    expect(bytesToBase64(new Uint8Array([1]))).toBe('AQ==')
    expect(bytesToBase64(new Uint8Array([1, 2]))).toBe('AQI=')
    expect(bytesToBase64(new Uint8Array([1, 2, 3]))).toBe('AQID')
  })

  it('matches the expected length formula for a real screenshot', () => {
    const bytes = pngishBytes(159_071)
    const b64 = bytesToBase64(bytes)
    expect(b64.length).toBe(Math.ceil(159_071 / 3) * 4)
  })
})
