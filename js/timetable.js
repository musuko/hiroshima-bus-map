// js/timetable.js

if (typeof window.timetableCache === 'undefined') {
    window.timetableCache = {};
}

// 会社ごとのキャンセル用（fetch自体を止める）
window.currentAborts = {};
// 現在表示処理中の最新StopIDを記録
window.activeDisplayStopId = "";

async function getTimetableForStop(stopId, companyId = 'hiroden') {
    if (window.currentAborts[companyId]) {
        window.currentAborts[companyId].abort();
    }
    window.currentAborts[companyId] = new AbortController();
    const signal = window.currentAborts[companyId].signal;

    while (!window.isGtfsReady) await new Promise(r => setTimeout(r, 100));

    const cacheKey = `${companyId}_${stopId}`;
    if (window.timetableCache[cacheKey]) {
        return filterAndProcessTimetable(window.timetableCache[cacheKey], companyId);
    }

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
    const processed = data.map(item => {
        const globalTripId = `${companyId}_${item.tripId}`;
        const tripData = window.tripLookup[globalTripId];
        if (!tripData) return null;
        if (!window.activeServiceIds.has(tripData.serviceId)) return null;
        const routeInfo = window.routeLookup[tripData.routeId] || { no: "??", name: "不明" };
        return { time: item.depTime.substring(0, 5), routeNo: routeInfo.no, headsign: routeInfo.name, companyId: companyId };
    }).filter(v => v !== null);
    return processed;
}

async function showUnifiedTimetable(stopId, companyIds, elementId) {
    // 【最重要】現在表示しようとしているIDをグローバルに記録
    window.activeDisplayStopId = stopId;
    
    let container = null;
    for (let i = 0; i < 10; i++) {
        container = document.getElementById(elementId);
        if (container) break;
        await new Promise(r => setTimeout(r, 100));
    }
    if (!container) return;

    const originalHeader = container.innerHTML.split('<hr>')[0] || `<strong>時刻表</strong>`;

    try {
        const promises = companyIds.map(cid => getTimetableForStop(stopId, cid));
        const results = await Promise.all(promises);

        // 【最重要】重い処理が終わった後、今まだそのバス停が「主役」か確認
        if (window.activeDisplayStopId !== stopId) {
            console.log(`🚫 破棄: ${stopId} はもう最新ではありません。`);
            return;
        }

        let combined = results.flat().sort((a, b) => a.time.localeCompare(b.time));

        if (combined.length === 0) {
            container.innerHTML = `${originalHeader}<hr><div style="padding:10px; color:#666;">本日の運行予定はありません</div>`;
        } else {
            let html = `${originalHeader}<hr><div style="max-height:250px; overflow-y:auto;"><table style="width:100%; font-size:12px; border-collapse:collapse;">`;
            combined.forEach(item => {
                const color = (item.companyId === 'hirobus') ? '#e60012' : '#82c91e';
                html += `<tr style="border-bottom:1px solid #eee;">
                    <td style="padding:6px 0; font-weight:bold; width:45px;">${item.time}</td>
                    <td style="padding:6px 2px; width:40px;"><span style="background:${color}; color:#fff; padding:2px 4px; border-radius:3px; font-weight:bold; font-size:10px;">${item.routeNo}</span></td>
                    <td style="padding:6px 0;">${item.headsign}</td>
                </tr>`;
            });
            html += `</table></div>`;
            container.innerHTML = html;
        }
    } catch (e) {
        console.error("更新エラー:", e);
    }
}

window.showUnifiedTimetable = showUnifiedTimetable;
