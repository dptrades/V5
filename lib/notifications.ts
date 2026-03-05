/**
 * Notification Service
 * Sends email and SMS alerts for trading discoveries
 */

import { env } from './env';
import { localDateString } from './localdate';

export interface NotificationPayload {
    subject: string;
    message: string;
    stocks?: Array<{
        symbol: string;
        signal: string;
        strength: number;
    }>;
}

/**
 * Send email notification via Resend
 * Requires: RESEND_API_KEY environment variable
 */
export async function sendEmailAlert(payload: NotificationPayload): Promise<boolean> {
    const recipients = env.emailRecipients;
    if (recipients.length === 0) {
        console.log('[Notify] Email skipped - no recipients configured');
        return false;
    }

    try {
        // Format stock list as HTML table
        let stocksHtml = '';
        if (payload.stocks && payload.stocks.length > 0) {
            stocksHtml = `
                <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
                    <tr style="background: #1e293b; color: white;">
                        <th style="padding: 10px; text-align: left;">Symbol</th>
                        <th style="padding: 10px; text-align: left;">Signal</th>
                        <th style="padding: 10px; text-align: right;">Strength</th>
                    </tr>
                    ${payload.stocks.map((s, i) => `
                        <tr style="background: ${i % 2 === 0 ? '#f8fafc' : '#e2e8f0'};">
                            <td style="padding: 10px; font-weight: bold;">${s.symbol}</td>
                            <td style="padding: 10px;">${s.signal}</td>
                            <td style="padding: 10px; text-align: right; color: ${s.strength >= 70 ? '#16a34a' : '#f59e0b'};">${s.strength}%</td>
                        </tr>
                    `).join('')}
                </table>
            `;
        }

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1e40af, #7c3aed); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🎯 DP TradeDesk Alert</h1>
                </div>
                <div style="padding: 20px; background: #f8fafc;">
                    <p style="font-size: 16px; color: #334155;">${payload.message}</p>
                    ${stocksHtml}
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${env.baseUrl}/conviction" 
                           style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            View Alpha Hunter →
                        </a>
                    </div>
                </div>
                <div style="padding: 15px; background: #1e293b; text-align: center;">
                    <p style="color: #94a3b8; margin: 0; font-size: 12px;">DP TradeDesk • Automated Trading Alerts</p>
                </div>
            </div>
        `;

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'DP TradeDesk <alerts@resend.dev>',
                to: recipients,
                subject: payload.subject,
                html: html
            })
        });

        if (response.ok) {
            console.log(`[Notify] Email sent to ${recipients.join(', ')}`);
            return true;
        } else {
            const error = await response.text();
            console.error('[Notify] Email failed:', error);
            return false;
        }
    } catch (e) {
        console.error('[Notify] Email error:', e);
        return false;
    }
}

/**
 * Send SMS notification via Twilio
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */
export async function sendSMSAlert(payload: NotificationPayload): Promise<boolean> {
    if (!env.hasSMS) {
        console.log('[Notify] SMS skipped - Twilio credentials not configured');
        return false;
    }

    const alertPhone = env.ALERT_SMS_PHONE!;

    try {
        // Format SMS message (keep it short)
        let smsBody = `🎯 ${payload.subject}\n\n`;

        if (payload.stocks && payload.stocks.length > 0) {
            const topStocks = payload.stocks.slice(0, 5);
            smsBody += topStocks.map(s => `${s.symbol}: ${s.signal} (${s.strength}%)`).join('\n');
            if (payload.stocks.length > 5) {
                smsBody += `\n+${payload.stocks.length - 5} more...`;
            }
        } else {
            smsBody += payload.message;
        }

        smsBody += '\n\n📱 DP TradeDesk';

        const accountSid = env.TWILIO_ACCOUNT_SID!;
        const authToken = env.TWILIO_AUTH_TOKEN!;
        const fromPhone = env.TWILIO_PHONE_NUMBER!;

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                To: alertPhone,
                From: fromPhone,
                Body: smsBody
            })
        });

        if (response.ok) {
            console.log(`[Notify] SMS sent to ${alertPhone}`);
            return true;
        } else {
            const error = await response.text();
            console.error('[Notify] SMS failed:', error);
            return false;
        }
    } catch (e) {
        console.error('[Notify] SMS error:', e);
        return false;
    }
}

/**
 * Send both email and SMS alerts
 */
export async function sendAlerts(payload: NotificationPayload): Promise<{ email: boolean; sms: boolean }> {
    const [emailResult, smsResult] = await Promise.all([
        sendEmailAlert(payload),
        sendSMSAlert(payload)
    ]);

    return {
        email: emailResult,
        sms: smsResult
    };
}

export interface MorningBriefPayload {
    topPicks: Array<{ symbol: string; signal: string; score: number; change: number }>;
    alphaHunter: Array<{ symbol: string; signal: string; score: number; change: number }>;
    socialPulse: Array<{ symbol: string; signal: string; heat: number; change: number }>;
}

export async function sendMorningBriefAlert(payload: MorningBriefPayload): Promise<boolean> {
    const recipients = env.emailRecipients;
    if (recipients.length === 0) {
        console.log('[Notify] Morning Brief skipped - no recipients configured');
        return false;
    }

    try {
        const renderRow = (s: any, scoreKey: string, scoreLabel: string) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${s.symbol}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 14px;">${s.signal}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: ${s[scoreKey] >= 70 ? '#16a34a' : '#f59e0b'}; font-weight: bold;">${s[scoreKey]} ${scoreLabel}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: ${s.change >= 0 ? '#16a34a' : '#ef4444'};">${s.change > 0 ? '+' : ''}${s.change.toFixed(2)}%</td>
            </tr>
        `;

        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                <div style="background: linear-gradient(135deg, #1e3a8a, #4338ca); padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">🌅 DP TradeDesk Morning Briefing</h1>
                    <p style="color: #cbd5e1; margin: 10px 0 0 0; font-size: 15px;">Your daily market advantage.</p>
                </div>
                
                <div style="padding: 30px 20px; background: #f8fafc;">
                    <!-- TOP PICKS -->
                    <h2 style="color: #0f172a; font-size: 18px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-top: 0;">🏆 Top Picks (Mega-Caps)</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        ${payload.topPicks.map(s => renderRow(s, 'score', 'pts')).join('')}
                    </table>

                    <!-- ALPHA HUNTER -->
                    <h2 style="color: #0f172a; font-size: 18px; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">🐺 Alpha Hunter (Growth & Momentum)</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        ${payload.alphaHunter.map(s => renderRow(s, 'score', 'pts')).join('')}
                    </table>

                    <!-- SOCIAL PULSE -->
                    <h2 style="color: #0f172a; font-size: 18px; border-bottom: 2px solid #ef4444; padding-bottom: 8px;">🔥 Social Pulse (Retail Momentum)</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        ${payload.socialPulse.map(s => renderRow(s, 'heat', '🔥')).join('')}
                    </table>

                    <div style="text-align: center; margin-top: 40px;">
                        <a href="${env.baseUrl}" style="display: inline-block; padding: 14px 28px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: background 0.2s;">
                            Open Dashboard
                        </a>
                    </div>
                </div>
                
                <div style="padding: 20px; background: #0f172a; text-align: center;">
                    <p style="color: #64748b; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} DP TradeDesk. Automated Trading Intelligence.</p>
                </div>
            </div>
        `;

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'DP TradeDesk <alerts@resend.dev>',
                to: recipients,
                subject: `🌅 Morning Briefing - ${localDateString()}`,
                html: html
            })
        });

        if (response.ok) {
            console.log(`[Notify] Morning Brief sent to ${recipients.join(', ')}`);
            return true;
        } else {
            const error = await response.text();
            console.error('[Notify] Morning Brief failed:', error);
            return false;
        }
    } catch (e) {
        console.error('[Notify] Morning Brief error:', e);
        return false;
    }
}
