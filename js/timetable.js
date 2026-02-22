// js/timetable.js

if (typeof window.timetableCache === 'undefined') {
    window.timetableCache = {};
}

window.currentAborts = {};
window.activeDisplayStopId = "";

async function getTimetableForStop(stopId, companyId = 'hiroden') {
    // キャッシュがあれば、AbortControllerを介さず即座にデータを返す（最速ルート）
    const cacheKey = `${companyId}_${stopId}`;
    if (window.timetableCache[cacheKey]) {
        return filterAndProcessTimetable(window.timetableCache[cacheKey], companyId);
    }

    if (window.currentAborts[companyId]) {
        window.currentAborts[companyId].abort();
    }
    window.currentAborts[companyId] = new AbortController();
    const signal = window.currentAborts[companyId].signal;

    try {
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) return [];

        const response = await fetch(`${company.staticPath}stop_times.txt`, { signal });
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let stopSpecificData = [];
        let isFirstLine = true;
        let idxTripId, idxDepTime, idxStopId;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (signal.aborted) throw new Error('AbortError');

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
        window.timetableCache[cacheKey] = stopSpecificData;
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
    // 1. 状態のリセット（これからこのIDを表示することを明確にする）
    window.activeDisplayStopId = stopId;
    
    // 2. 表示先コンテナの確保（少し粘り強く探す）
    let container = null;
    for (let i = 0; i < 20; i++) { // 回数を増やして2秒間待機
        container = document.getElementById(elementId);
        if (container) break;
        await new Promise(r => setTimeout(r, 100));
    }
    
    if (!container) return;

    // 3. 読み込み中状態を再セット（再表示時も「読み込み中」を確実に出す）
    const originalHeader = container.innerHTML.split('<hr>')[0] || `<strong>時刻表</strong>`;
    if (!container.innerHTML.includes('<table')) {
        container.innerHTML = `${originalHeader}<hr><div id="loading-${stopId}">時刻表を読み込み中...</div>`;
    }

    try {
        const promises = companyIds.map(cid => getTimetableForStop(stopId, cid));
        const results = await Promise.all(promises);

        // 4. 表示判定：今のポップアップがまだこのIDを求めているか
        if (window.activeDisplayStopId !== stopId) return;

        let combined = results.flat().sort((a, b) => a.time.localeCompare(b.time));

        if (combined.length === 0) {
            container.innerHTML = `${originalHeader}<hr><div style="padding:10px; color:#666;">本日の運行予定はありません</div>`;
        } else {
            let html = `${originalHeader}<hr><div style="max-height:250px; overflow-y:auto;"><table style="width:100%; font-size:12px; border-collapse:collapse; background:white;">`;
            combined.forEach(item => {
                const color = (item.companyId === 'hirobus') ? '#e60012' : '#82c91e';
                html += `<tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px 0; font-weight:bold; width:45px; color:#333;">${item.time}</td>
                    <td style="padding:8px 2px; width:40px;"><span style="background:${color}; color:#fff; padding:2px 4px; border-radius:3px; font-weight:bold; font-size:10px;">${item.routeNo}</span></td>
                    <td style="padding:8px 0; color:#444;">${item.headsign}</td>
                </tr>`;
            });
            html += `</table></div>`;
            container.innerHTML = html;
        }
    } catch (e) {
        console.error("表示エラー:", e);
    }
}

window.showUnifiedTimetable = showUnifiedTimetable;
