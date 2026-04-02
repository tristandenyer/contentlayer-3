import { describe, it, expect } from 'vitest'
import { hashSpec, hashFile } from '../src/lib/hash.js'

describe('hashSpec', () => {
  it('returns consistent hash for same input regardless of key order', () => {
    const a = { z: 1, a: 'hello', m: [1, 2, 3] }
    const b = { m: [1, 2, 3], z: 1, a: 'hello' }
    expect(hashSpec(a)).toBe(hashSpec(b))
  })

  it('returns different hash for different input', () => {
    expect(hashSpec({ a: 1 })).not.toBe(hashSpec({ a: 2 }))
    expect(hashSpec({ a: 1 })).not.toBe(hashSpec({ b: 1 }))
  })

  it('prefixes result with sha256:', () => {
    expect(hashSpec({})).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('handles nested objects deterministically', () => {
    const a = { outer: { z: true, a: false } }
    const b = { outer: { a: false, z: true } }
    expect(hashSpec(a)).toBe(hashSpec(b))
  })

  it('handles null and primitives', () => {
    expect(hashSpec(null)).toMatch(/^sha256:/)
    expect(hashSpec(42)).toMatch(/^sha256:/)
    expect(hashSpec('hello')).toMatch(/^sha256:/)
  })
})

describe('hashFile', () => {
  it('hashes string content and returns sha256: prefix', () => {
    expect(hashFile('hello world')).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('returns same hash for same content', () => {
    expect(hashFile('abc')).toBe(hashFile('abc'))
  })

  it('returns different hash for different content', () => {
    expect(hashFile('abc')).not.toBe(hashFile('def'))
  })

  it('empty string produces a valid hash', () => {
    expect(hashFile('')).toMatch(/^sha256:[a-f0-9]{64}$/)
  })
})
