// js/timetable.js

if (!window.timetableDataStore) {
    window.timetableDataStore = {}; 
}
window.activeDisplayStopId = "";

async function getTimetableForStop(stopId, companyId = 'hiroden') {
    const cacheKey = `${companyId}_${stopId}`;
    if (window.timetableDataStore[cacheKey]) {
        // キャッシュがあっても少しだけ待つ（DOM描画との競合を避けるため安全策）
        await new Promise(r => setTimeout(r, 10)); 
        return filterAndProcessTimetable(window.timetableDataStore[cacheKey], companyId);
    }

    try {
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) return [];

        const response = await fetch(`${company.staticPath}stop_times.txt`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let stopSpecificData = [];
        let isFirstLine = true;
        let idxTripId, idxDepTime, idxStopId;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split(/\r?\n/);
            partialData = lines.pop(); 
            for (const line of lines) {
                if (!line.trim()) continue;
                const c = line.split(',').map(s => s.replace(/^"|"$/g, '').trim());
                if (isFirstLine) {
                    idxTripId = c.indexOf('trip_id');
                    idxDepTime = c.indexOf('departure_time');
                    idxStopId = c.indexOf('stop_id');
                    isFirstLine = false; continue;
                }
                if (c[idxStopId] === stopId.trim()) {
                    stopSpecificData.push({ tripId: c[idxTripId], depTime: c[idxDepTime] });
                }
            }
        }
        window.timetableDataStore[cacheKey] = stopSpecificData;
        return filterAndProcessTimetable(stopSpecificData, companyId);
    } catch (e) {
        return [];
    }
}

function filterAndProcessTimetable(data, companyId) {
    if (!window.activeServiceIds || !window.tripLookup) return [];
    return data.map(item => {
        const globalTripId = `${companyId}_${item.tripId}`;
        const tripData = window.tripLookup[globalTripId];
        if (!tripData || !window.activeServiceIds.has(tripData.serviceId)) return null;
        const routeInfo = window.routeLookup[tripData.routeId] || { no: "??", name: "不明" };
        return { time: item.depTime.substring(0, 5), routeNo: routeInfo.no, headsign: routeInfo.name, companyId: companyId };
    }).filter(v => v !== null);
}

async function showUnifiedTimetable(stopId, companyIds, elementId) {
    window.activeDisplayStopId = stopId;
    
    // 1. DOM要素が「確実に」現れるまで待つ
    let container = null;
    for (let i = 0; i < 30; i++) { // 最大3秒まで粘る
        container = document.getElementById(elementId);
        // かつ、まだ「読み込み中...」が表示されているか確認
        if (container && container.innerHTML.includes('読み込み中')) {
            break;
        }
        await new Promise(r => setTimeout(r, 100));
    }
    
    if (!container) {
        console.error("❌ 表示先が見つかりませんでした");
        return;
    }

    try {
        const results = await Promise.all(companyIds.map(cid => getTimetableForStop(stopId, cid)));

        // 2. 自分がまだ最新のリクエストか再確認
        if (window.activeDisplayStopId !== stopId) return;

        // 3. 描画直前に再度要素をチェック（ポップアップが閉じられていないか）
        const finalContainer = document.getElementById(elementId);
        if (!finalContainer) return;

        const originalHeader = finalContainer.innerHTML.split('<hr>')[0] || `<strong>時刻表</strong>`;
        let combined = results.flat().sort((a, b) => a.time.localeCompare(b.time));

        if (combined.length === 0) {
            finalContainer.innerHTML = `${originalHeader}<hr><div style="padding:10px; color:#666;">本日の運行予定はありません</div>`;
        } else {
            let html = `${originalHeader}<hr><div style="max-height:250px; overflow-y:auto;">`;
            html += `<table style="width:100%; font-size:12px; border-collapse:collapse; background:white;">`;
            combined.forEach(item => {
                const color = (item.companyId === 'hirobus') ? '#e60012' : '#82c91e';
                html += `<tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px 0; font-weight:bold; width:45px; color:#333;">${item.time}</td>
                    <td style="padding:8px 2px; width:40px;"><span style="background:${color}; color:#fff; padding:2px 4px; border-radius:3px; font-weight:bold; font-size:10px;">${item.routeNo}</span></td>
                    <td style="padding:8px 0; color:#444;">${item.headsign}</td>
                </tr>`;
            });
            html += `</table></div>`;
            finalContainer.innerHTML = html;
        }
    } catch (e) {
        console.error("Render Error:", e);
    }
}

window.showUnifiedTimetable = showUnifiedTimetable;
