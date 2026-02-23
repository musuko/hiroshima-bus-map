// js/trip_details.js

async function getFullTimetableForTrip(tripId, companyId) {
    console.log(`🔍 [車両クリック] tripId: ${tripId} の時刻表を直接探索します`);
    if (!tripId) return [];
    
    const company = BUS_COMPANIES.find(c => c.id === companyId);
    if (!company) return [];

    // ポップアップがDOMに生成されるのを待機（タイミング競合対策）
    let container = null;
    for (let i = 0; i < 10; i++) {
        container = document.querySelector('.leaflet-popup-content');
        if (container) break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
        // カレンダー判定を一切行わず、直接 stop_times.txt を読み込む
        const res = await fetch(`${company.staticPath}stop_times.txt`);
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        
        const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        const tIdx = head.indexOf('trip_id');
        const sIdx = head.indexOf('stop_id');
        const aIdx = head.indexOf('arrival_time');
        const sqIdx = head.indexOf('stop_sequence');

        const tripStops = [];
        
        // 全行をスキャンして trip_id が一致するものをすべて拾う
        for (let i = 1; i < lines.length; i++) {
            // 高速化のため、行全体にIDが含まれているかまずチェック
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

        if (tripStops.length > 0) {
            console.log(`✅ 表示確定: ${tripStops.length} 件の停留所を表示します`);
            return tripStops.sort((a, b) => a.sequence - b.sequence);
        } else {
            console.warn(`❌ stop_times.txt 内に tripId: ${tripId} が見つかりませんでした`);
            return [];
        }

    } catch (e) {
        console.error("❌ 時刻表取得エラー:", e);
        return [];
    }
}

window.getFullTimetableForTrip = getFullTimetableForTrip;
