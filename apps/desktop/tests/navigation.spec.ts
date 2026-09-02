import { describe, expect, it } from 'vitest'
import { authenticatedApplicationUrl, isApplicationNavigation, isExternalWebUrl } from '../src/navigation.ts'

describe('desktop navigation policy', () => {
  it('asks Connection to authenticate the loopback origin', () => {
    const authenticatedUrl = (baseUrl: string) => {
      expect(baseUrl).toBe('http://127.0.0.1:43123')
      return 'http://127.0.0.1:43123/?token=launch'
    }
    expect(authenticatedApplicationUrl(43123, authenticatedUrl)).toBe('http://127.0.0.1:43123/?token=launch')
  })

  it('keeps the application window on its exact loopback origin', () => {
    expect(isApplicationNavigation('http://127.0.0.1:43123/settings', 'http://127.0.0.1:43123')).toBe(true)
    expect(isApplicationNavigation('http://127.0.0.1:43124/', 'http://127.0.0.1:43123')).toBe(false)
    expect(isApplicationNavigation('https://example.com/', 'http://127.0.0.1:43123')).toBe(false)
    expect(isApplicationNavigation('not a URL', 'http://127.0.0.1:43123')).toBe(false)
  })

  it('opens only HTTP links through the system browser', () => {
    expect(isExternalWebUrl('https://example.com/docs')).toBe(true)
    expect(isExternalWebUrl('http://example.com/docs')).toBe(true)
    expect(isExternalWebUrl('file:///etc/passwd')).toBe(false)
    expect(isExternalWebUrl('javascript:alert(1)')).toBe(false)
  })
})
