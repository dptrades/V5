/**
 * Automation script to trigger daily option performance updates
 * This script runs a check every minute and triggers the update API at 4:00 PM (16:00) EST.
 */

const TRIGGER_HOUR = 16; // 4 PM
const TRIGGER_MINUTE = 0;
const API_URL = 'http://localhost:3000/api/options/track/update';

console.log(`[Scheduler] Tracking update scheduled for ${TRIGGER_HOUR}:00 Eastern Time.`);

async function triggerUpdate() {
    console.log(`[Scheduler] Triggering daily update at ${new Date().toLocaleString()}...`);
    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            const result = await response.json();
            console.log(`[Scheduler] Successfully updated!`, result);
        } else {
            console.error(`[Scheduler] Update failed with status: ${response.status}`);
        }
    } catch (e) {
        console.error(`[Scheduler] Error reaching API:`, e.message);
    }
}

// Check every minute
setInterval(() => {
    const now = new Date();
    // Convert to Eastern Time check if needed, but assuming server runs in EST/Local
    // For simplicity, we use local system time.
    if (now.getHours() === TRIGGER_HOUR && now.getMinutes() === TRIGGER_MINUTE) {
        triggerUpdate();
    }
}, 60000);

// Also run once on startup for immediate feedback (optional, but good for verification)
console.log(`[Scheduler] Keep this process running to ensure daily updates.`);
