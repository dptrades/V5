/**
 * Environment Variable Configuration
 * Centralizes environment variable access with validation and defaults
 */

// Helper to get required env var (throws if missing in production)
function getEnvOrThrow(key: string): string {
    const value = process.env[key];
    if (!value && process.env.NODE_ENV === 'production') {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value || '';
}

// Helper to get optional env var with default
function getEnvOrDefault<T extends string | null>(key: string, defaultValue: T): string | T {
    return process.env[key] || defaultValue;
}

/**
 * Application Environment Configuration
 * Use this instead of accessing process.env directly
 */
export const env = {
    // Node Environment
    NODE_ENV: process.env.NODE_ENV || 'development',
    IS_PRODUCTION: process.env.NODE_ENV === 'production',
    IS_DEVELOPMENT: process.env.NODE_ENV === 'development',

    // Alpaca Trading API
    ALPACA_API_KEY: getEnvOrDefault('ALPACA_API_KEY', null),
    ALPACA_API_SECRET: getEnvOrDefault('ALPACA_API_SECRET', null),
    JWT_SECRET: getEnvOrDefault('JWT_SECRET', null),
    get hasAlpaca() {
        return Boolean(this.ALPACA_API_KEY && this.ALPACA_API_SECRET);
    },

    // Clerk Authentication
    CLERK_PUBLISHABLE_KEY: getEnvOrDefault('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', null),
    CLERK_SECRET_KEY: getEnvOrDefault('CLERK_SECRET_KEY', null),
    get hasClerk() {
        return Boolean(this.CLERK_PUBLISHABLE_KEY && this.CLERK_SECRET_KEY);
    },

    // Notification Services
    RESEND_API_KEY: getEnvOrDefault('RESEND_API_KEY', null),
    ALERT_EMAIL: getEnvOrDefault('ALERT_EMAIL', null),
    ALERT_EMAILS: getEnvOrDefault('ALERT_EMAILS', null),
    get hasEmail() {
        return Boolean(this.RESEND_API_KEY && (this.ALERT_EMAIL || this.ALERT_EMAILS));
    },
    get emailRecipients(): string[] {
        if (this.ALERT_EMAILS) return this.ALERT_EMAILS.split(',').map(e => e.trim());
        if (this.ALERT_EMAIL) return [this.ALERT_EMAIL];
        return [];
    },

    TWILIO_ACCOUNT_SID: getEnvOrDefault('TWILIO_ACCOUNT_SID', null),
    TWILIO_AUTH_TOKEN: getEnvOrDefault('TWILIO_AUTH_TOKEN', null),
    TWILIO_PHONE_NUMBER: getEnvOrDefault('TWILIO_PHONE_NUMBER', null),
    ALERT_SMS_PHONE: getEnvOrDefault('ALERT_SMS_PHONE', null),
    get hasSMS() {
        return Boolean(
            this.TWILIO_ACCOUNT_SID &&
            this.TWILIO_AUTH_TOKEN &&
            this.TWILIO_PHONE_NUMBER &&
            this.ALERT_SMS_PHONE
        );
    },


    // Cron Jobs
    CRON_SECRET: getEnvOrDefault('CRON_SECRET', null),

    // Vercel
    VERCEL_URL: getEnvOrDefault('VERCEL_URL', null),
    get baseUrl() {
        return this.VERCEL_URL
            ? `https://${this.VERCEL_URL}`
            : 'https://dptradedesk.vercel.app';
    },

    // Public.com API
    PUBLIC_API_KEY: getEnvOrDefault('PUBLIC_API_KEY', null),
    PUBLIC_API_SECRET: getEnvOrDefault('PUBLIC_API_SECRET', null),
    get hasPublic() {
        return Boolean(this.PUBLIC_API_SECRET);
    },
    // Schwab API
    SCHWAB_CLIENT_ID: getEnvOrDefault('SCHWAB_CLIENT_ID', null),
    SCHWAB_CLIENT_SECRET: getEnvOrDefault('SCHWAB_CLIENT_SECRET', null),
    SCHWAB_REFRESH_TOKEN: getEnvOrDefault('SCHWAB_REFRESH_TOKEN', null),
    get hasSchwab() {
        return Boolean(this.SCHWAB_CLIENT_ID && this.SCHWAB_CLIENT_SECRET);
    },
    // Trader Access
    TRADER_ACCESS_KEY: getEnvOrDefault('TRADER_ACCESS_KEY', null),

    // Finnhub API (Market Intelligence)
    FINNHUB_API_KEY: getEnvOrDefault('FINNHUB_API_KEY', null),
    get hasFinnhub() {
        return Boolean(this.FINNHUB_API_KEY);
    },
} as const;

/**
 * Validate required environment variables
 * Call this during app startup to fail fast
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
    const requiredInProduction = [
        'ALPACA_API_KEY',
        'ALPACA_API_SECRET',
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
        'CLERK_SECRET_KEY',
        'JWT_SECRET',
        'TRADER_ACCESS_KEY',
        'FINNHUB_API_KEY'
    ];

    const missing: string[] = [];

    if (env.IS_PRODUCTION) {
        for (const key of requiredInProduction) {
            if (!process.env[key]) {
                missing.push(key);
            }
        }
    }

    return {
        valid: missing.length === 0,
        missing
    };
}

/**
 * Log environment status (safe for logs, no secrets)
 */
export function logEnvStatus(): void {
    console.log('[Env] Environment Status:');
    console.log(`  - Mode: ${env.NODE_ENV}`);
    console.log(`  - Alpaca: ${env.hasAlpaca ? '✓' : '✗'}`);
    console.log(`  - Clerk: ${env.hasClerk ? '✓' : '✗'}`);
    console.log(`  - Email Alerts: ${env.hasEmail ? '✓' : '✗'}`);
    console.log(`  - SMS Alerts: ${env.hasSMS ? '✓' : '✗'}`);
    console.log(`  - Finnhub: ${env.hasFinnhub ? '✓' : '✗'}`);
    console.log(`  - Base URL: ${env.baseUrl}`);
}
