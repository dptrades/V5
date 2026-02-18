import { NextResponse } from 'next/server';
import { finnhubClient } from '@/lib/finnhub';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params;

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        const financials = await finnhubClient.getBasicFinancials(symbol.toUpperCase());

        if (!financials) {
            return NextResponse.json({ error: 'No financial data found' }, { status: 404 });
        }

        const metrics = financials.metric;

        // Calculate Quality Score (0-5)
        const peg = metrics.pegTTM || metrics.pegRatio;
        const de = metrics['totalDebt/totalEquityTTM'] || metrics['totalDebt/totalEquityQuarterly'] || metrics['totalDebt/totalEquityAnnual'] || metrics.debtToEquity;
        const pe = metrics.peTTM;

        // Derive Free Cash Flow if direct field is missing
        let fcf = metrics.freeCashFlowTTM || metrics.freeCashFlowAnnual;
        const pfcf = metrics.pfcfShareTTM;
        const evFcf = metrics['currentEv/freeCashFlowTTM'];

        if (!fcf) {
            if (pfcf && pfcf > 0 && metrics.marketCapitalization) {
                fcf = metrics.marketCapitalization / pfcf;
            } else if (evFcf && evFcf > 0 && metrics.enterpriseValue) {
                fcf = metrics.enterpriseValue / evFcf;
            }
        }

        let qualityScore = 0;
        const checks = {
            epsGrowth: (metrics.epsGrowthTTMYoy || 0) > 10,
            roe: (metrics.roeTTM || 0) > 15,
            peg: (peg !== undefined && peg < 1.2),
            de: (de !== undefined && de < 1.0),
            fcf: (fcf !== undefined ? fcf > 0 : (pfcf !== undefined ? pfcf > 0 : false)),
            pe: (pe !== undefined && pe > 0 && pe < 25)
        };

        if (checks.epsGrowth) qualityScore++;
        if (checks.roe) qualityScore++;
        if (checks.peg) qualityScore++;
        if (checks.de) qualityScore++;
        if (checks.fcf) qualityScore++;
        if (checks.pe) qualityScore++;

        return NextResponse.json({
            symbol: symbol.toUpperCase(),
            marketCap: metrics.marketCapitalization,
            qualityScore,
            metrics: {
                epsGrowth: metrics.epsGrowthTTMYoy,
                roe: metrics.roeTTM,
                peg: peg,
                pe: pe,
                de: de,
                fcf: fcf
            },
            checks
        });
    } catch (error) {
        console.error(`[Fundamentals API] Error for ${symbol}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
