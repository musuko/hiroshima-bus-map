// js/trip_details.js

async function getFullTimetableForTrip(tripId, companyId) {
    console.log(`🔍 [検証開始] tripId: ${tripId}, companyId: ${companyId}`);
    if (!tripId) return [];
    const company = BUS_COMPANIES.find(c => c.id === companyId);
    if (!company) {
        console.error("❌ 該当する会社が見つかりません");
        return [];
    }

    let container = null;
    for (let i = 0; i < 10; i++) {
        container = document.querySelector('.leaflet-popup-content');
        if (container) break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    if (!container) console.warn("⚠️ ポップアップコンテナがまだ見つかりません（待機終了）");

    try {
        const activeServices = await window.CalendarManager.getTodayServiceIds(company);
        console.log(`📅 今日の有効ServiceId:`, activeServices);

        const tripRes = await fetch(`${company.staticPath}trips.txt`);
        const tripText = await tripRes.text();
        const tripLines = tripText.trim().split(/\r?\n/);
        
        // 特定の tripId を探す
        const tripInfo = tripLines.find(line => line.includes(tripId));
        if (!tripInfo) {
            console.error(`❌ trips.txt 内に tripId: ${tripId} が見つかりません`);
            return [];
        }

        const tripHead = tripLines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        const cols = tripInfo.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        const serviceId = cols[tripHead.indexOf('service_id')];
        
        console.log(`ℹ️ この便の service_id: ${serviceId}`);

        if (!activeServices.includes(serviceId)) {
            console.warn(`🚫 フィルタ拒否: service_id ${serviceId} は今日の運行リストにありません`);
            return []; 
        }

        const res = await fetch(`${company.staticPath}stop_times.txt`);
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        console.log(`📄 stop_times.txt 読み込み完了 (${lines.length} 行)`);

        const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        const tIdx = head.indexOf('trip_id');
        const sIdx = head.indexOf('stop_id');
        const aIdx = head.indexOf('arrival_time');
        const sqIdx = head.indexOf('stop_sequence');

        const tripStops = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].includes(tripId)) {
                const c = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (c[tIdx] === tripId) {
                    tripStops.push({
                        stopId: c[sIdx],
                        stopName: window.stopLookup[c[sIdx]]?.name || `停留所(${c[sIdx]})`,
                        time: c[aIdx] ? c[aIdx].substring(0, 5) : "--:--",
                        sequence: parseInt(c[sqIdx])
                    });
                }
            }
        }

        console.log(`✅ 抽出完了: ${tripStops.length} 件の停留所が見つかりました`);
        return tripStops.sort((a, b) => a.sequence - b.sequence);

    } catch (e) {
        console.error("❌ 致命的エラー:", e);
        return [];
    }
}

window.getFullTimetableForTrip = getFullTimetableForTrip;
