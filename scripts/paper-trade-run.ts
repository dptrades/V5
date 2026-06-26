import {
    updatePositionsAndExits,
    runSimulatedMorningScan,
    logDailyPerformance,
    sendDailySummary
} from '../lib/paper-trading';

// Load env variables
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    // Parse args
    const args = process.argv.slice(2);
    const actionArg = args.find(a => a.startsWith('--action='));
    const action = actionArg ? actionArg.split('=')[1] : args[0];

    if (!action || (action !== 'morning' && action !== 'close')) {
        console.error('Usage: npx ts-node scripts/paper-trade-run.ts [morning|close]');
        process.exit(1);
    }

    console.log(`[Sim-Scheduler] Starting action: ${action}`);
    
    try {
        if (action === 'morning') {
            console.log('[Sim-Scheduler] Executing exits and entry scans...');
            const { closedTrades } = await updatePositionsAndExits();
            const { enteredTrades } = await runSimulatedMorningScan();
            await sendDailySummary('morning', { enteredTrades, closedTrades });
            console.log('[Sim-Scheduler] Morning scan complete.');
        } else if (action === 'close') {
            console.log('[Sim-Scheduler] Executing market close updates...');
            const { closedTrades } = await updatePositionsAndExits();
            const dailyLog = await logDailyPerformance();
            await sendDailySummary('close', { closedTrades, dailyLog });
            console.log('[Sim-Scheduler] Market close updates complete.');
        }
    } catch (e) {
        console.error('[Sim-Scheduler] Error during execution:', e);
        process.exit(1);
    }
}

run();
