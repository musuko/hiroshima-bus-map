// js/trip_details.js

async function getFullTimetableForTrip(tripId, companyId) {
    if (!tripId) return [];
    const company = BUS_COMPANIES.find(c => c.id === companyId);
    if (!company) return [];

    try {
        const res = await fetch(`${company.staticPath}stop_times.txt`);
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));

        const tIdx = head.indexOf('trip_id');
        const sIdx = head.indexOf('stop_id');
        const aIdx = head.indexOf('arrival_time');
        const sqIdx = head.indexOf('stop_sequence');

        const tripStops = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (cols[tIdx] === tripId) {
                const sId = cols[sIdx];
                tripStops.push({
                    stopId: sId,
                    stopName: window.stopLookup[sId]?.name || `停留所(${sId})`,
                    time: cols[aIdx] ? cols[aIdx].substring(0, 5) : "--:--",
                    sequence: parseInt(cols[sqIdx])
                });
            }
        }
        return tripStops.sort((a, b) => a.sequence - b.sequence);
    } catch (e) {
        console.error("便詳細取得エラー:", e);
        return [];
    }
}

// グローバル登録
window.getFullTimetableForTrip = getFullTimetableForTrip;
console.log("✅ trip_details.js の読み込みが完了しました");
