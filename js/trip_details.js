// js/trip_details.js

async function getFullTimetableForTrip(tripId, companyId) {
    // console.log はデバッグ用に残しても良いですが、warn は消します
    if (!tripId) return [];
    
    const company = BUS_COMPANIES.find(c => c.id === companyId);
    if (!company) return [];

    let container = null;
    for (let i = 0; i < 10; i++) {
        container = document.querySelector('.leaflet-popup-content');
        if (container) break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }

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
            if (lines[i].includes(tripId)) {
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
        }

        // 並び替えて返す（空なら [] が返る）
        return tripStops.sort((a, b) => a.sequence - b.sequence);

    } catch (e) {
        // fetch自体に失敗した場合のみエラーログを出す
        return [];
    }
}

window.getFullTimetableForTrip = getFullTimetableForTrip;
