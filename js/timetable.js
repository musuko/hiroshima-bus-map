// js/timetable.js

if (typeof window.timetableCache === 'undefined') {
    window.timetableCache = {};
}

async function getTimetableForStop(stopId, companyId = 'hiroden') {
    while(!window.isGtfsReady) await new Promise(r => setTimeout(r, 100));

    const cacheKey = `${companyId}_${stopId}`;
    if (window.timetableCache[cacheKey]) {
        console.log(`♻️ キャッシュを使用: ${cacheKey}`);
        return filterAndProcessTimetable(window.timetableCache[cacheKey], companyId);
    }

    try {
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) throw new Error("会社設定が見つかりません");

        console.log(`🚀 ${company.name} スキャン開始: 検索ID [${stopId}]`);
        const response = await fetch(`${company.staticPath}stop_times.txt`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let stopSpecificData = [];

        let idxTripId, idxDepTime, idxStopId;
        let isFirstLine = true;

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
                    isFirstLine = false;
                    console.log(`📌 列配置: trip=${idxTripId}, time=${idxDepTime}, stop=${idxStopId}`);
                    continue;
                }
                
                // ここでID比較
                if (c[idxStopId] === stopId.trim()) {
                    stopSpecificData.push({ 
                        tripId: c[idxTripId], 
                        depTime: c[idxDepTime] 
                    });
                }
            }
        }

        console.log(`📊 ${company.name} 抽出結果: ${stopSpecificData.length} 件`);
        window.timetableCache[cacheKey] = stopSpecificData;
        return filterAndProcessTimetable(stopSpecificData, companyId);
    } catch (e) {
        console.error("❌ 時刻表スキャン致命的エラー:", e);
        return [];
    }
}

function filterAndProcessTimetable(data, companyId) {
    console.log(`🛠 フィルタリング開始: ${companyId} (${data.length}件)`);
    if (!window.activeServiceIds || !window.tripLookup) {
        console.warn("⚠️ 辞書が準備できていません");
        return [];
    }

    const processed = data.map(item => {
        const globalTripId = `${companyId}_${item.tripId}`;
        const tripData = window.tripLookup[globalTripId];

        if (!tripData) return null;

        const isActive = window.activeServiceIds.has(tripData.serviceId);
        if (!isActive) return null;

        const routeId = tripData.routeId;
        const routeInfo = window.routeLookup[routeId] || { no: "??", name: "不明" };

        return {
            time: item.depTime.substring(0, 5),
            routeNo: routeInfo.no,
            headsign: routeInfo.name,
            companyId: companyId
        };
    }).filter(v => v !== null);

    console.log(`✨ フィルタリング後: ${processed.length} 件`);
    return processed.sort((a, b) => a.time.localeCompare(b.time));
}

// showUnifiedTimetable は以前のままでOKですが、
// コンテナの中身が空の時の表示だけ少し詳細にします
async function showUnifiedTimetable(stopId, companyIds, elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;
    const stopName = container.querySelector('strong') ? container.querySelector('strong').innerText : "時刻表";

    try {
        const promises = companyIds.map(cid => getTimetableForStop(stopId, cid));
        const results = await Promise.all(promises);
        let combined = results.flat();
        combined.sort((a, b) => a.time.localeCompare(b.time));

        if (combined.length === 0) {
            container.innerHTML = `<strong>${stopName}</strong><br><hr>本日の運行予定はありません<br><small style="color:gray;">(StopID: ${stopId})</small>`;
            return;
        }

        let html = `<strong>${stopName}</strong><br><hr><div style="max-height:250px; overflow-y:auto;"><table style="width:100%; font-size:12px; border-collapse:collapse;">`;
        combined.forEach(item => {
            const color = (item.companyId === 'hirobus') ? '#e60012' : '#82c91e';
            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:6px 0; font-weight:bold; width:45px;">${item.time}</td>
                <td style="padding:6px 2px; width:40px;"><span style="background:${color}; color:#fff; padding:2px 4px; border-radius:3px; font-weight:bold;">${item.routeNo}</span></td>
                <td style="padding:6px 0;">${item.headsign}</td>
            </tr>`;
        });
        html += `</table></div>`;
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = "エラーが発生しました。";
    }
}

window.showUnifiedTimetable = showUnifiedTimetable;
window.getTimetableForStop = getTimetableForStop;
