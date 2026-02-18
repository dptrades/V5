import axios from 'axios';
import { OHLCVData } from '@/types/financial';


export interface OHLCVResponse {
    data: OHLCVData[];
    companyName: string;
}

// Default to Bitcoin and 1 day interval for now
export const fetchOHLCV = async (coinId: string = 'SPY', days: string = '30', market: 'stocks' = 'stocks', interval: string = '1d'): Promise<OHLCVResponse> => {
    try {
        const response = await axios.get('/api/ohlcv', {
            params: {
                symbol: coinId,
                days: days, // legacy or for ranges
                market: market,
                interval: interval,
                _t: Date.now() // Cache-buster
            }
        });

        // Handle both old format (array) and new format (object with data + companyName)
        if (Array.isArray(response.data)) {
            return { data: response.data, companyName: coinId };
        }

        return {
            data: response.data.data || [],
            companyName: response.data.companyName || coinId
        };
    } catch (error) {
        console.error('Error fetching OHLCV data:', error);
        return { data: [], companyName: coinId };
    }
};
