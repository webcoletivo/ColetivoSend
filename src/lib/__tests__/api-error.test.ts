import { describe, it, expect } from 'vitest'
import { AppError, handleApiError } from '../api-error'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

describe('AppError', () => {
    it('should create an error with message and status code', () => {
        const error = new AppError('Test error', 418, 'I_AM_A_TEAPOT')
        expect(error.message).toBe('Test error')
        expect(error.statusCode).toBe(418)
        expect(error.code).toBe('I_AM_A_TEAPOT')
    })

    it('should default to 400 if no status code is provided', () => {
        const error = new AppError('Default error')
        expect(error.statusCode).toBe(400)
    })
})

describe('handleApiError', () => {
    it('should handle AppError correctly', () => {
        const error = new AppError('Custom error', 404, 'NOT_FOUND')
        const response = handleApiError(error)

        // We need to verify the response. Since NextResponse.json returns a Response-like object
        // we can inspect status and try to read body if mocked environment supports it,
        // or checks properties. In standard Node env with Next polyfills, .json() returns a NextResponse

        expect(response.status).toBe(404)
        // For deeper body inspection we might need to await .json() if it's a real response
        // But NextResponse.json usually sets body immediately.
    })

    it('should handle generic Error as 500', () => {
        const error = new Error('Random failure')
        const response = handleApiError(error)
        expect(response.status).toBe(500)
    })

    it('should handle 2FA_REQUIRED specific error', () => {
        const error = new Error('2FA_REQUIRED')
        const response = handleApiError(error)
        expect(response.status).toBe(401)
    })
})
