// js/timetable.js

// キャッシュの二重宣言を防ぐ
if (typeof window.timetableCache === 'undefined') {
    window.timetableCache = {};
}

async function getTimetableForStop(stopId, companyId = 'hiroden') {
    // 辞書の準備ができるまで待つ
    while(!window.isGtfsReady) await new Promise(r => setTimeout(r, 100));

    const cacheKey = `${companyId}_${stopId}`;
    if (window.timetableCache[cacheKey]) {
        return filterAndProcessTimetable(window.timetableCache[cacheKey], companyId);
    }

    try {
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) throw new Error("会社設定が見つかりません");

        console.log(`🔍 ${company.name} の時刻表をスキャン中: ${stopId}`);
        const response = await fetch(`${company.staticPath}stop_times.txt`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let stopSpecificData = [];

        let idxTripId, idxDepTime, idxStopId;
        let isFirstChunk = true;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split(/\r?\n/);
            partialData = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                const c = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (isFirstChunk) {
                    idxTripId = c.indexOf('trip_id');
                    idxDepTime = c.indexOf('departure_time');
                    idxStopId = c.indexOf('stop_id');
                    isFirstChunk = false;
                    continue;
                }
                if (c[idxStopId] === stopId) {
                    stopSpecificData.push({ tripId: c[idxTripId], depTime: c[idxDepTime] });
                }
            }
        }

        window.timetableCache[cacheKey] = stopSpecificData;
        return filterAndProcessTimetable(stopSpecificData, companyId);
    } catch (e) {
        console.error("時刻表エラー:", e);
        return [];
    }
}

function filterAndProcessTimetable(data, companyId) {
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    return data
        .filter(item => {
            const t = item.depTime;
            return t >= currentTimeStr || t.startsWith('24') || t.startsWith('25');
        })
        .map(item => {
            const globalTripId = `${companyId}_${item.tripId}`;
            const globalRouteId = window.tripLookup[globalTripId];
            const routeInfo = window.routeLookup[globalRouteId] || { no: "??", name: "不明" };
            const jpInfo = window.routeJpLookup[globalRouteId];
            
            let headsign = routeInfo.name;
            if (jpInfo) {
                const origin = (jpInfo.origin || "").trim();
                const dest = (jpInfo.dest || "").trim();
                const parentIdName = (jpInfo.jp_parent_route_id || "").trim();
                if (origin === dest && parentIdName !== "") headsign = parentIdName;
            }

            return {
                time: item.depTime.substring(0, 5),
                routeNo: routeInfo.no,
                headsign: headsign,
                companyId: companyId
            };
        })
        .sort((a, b) => a.time.localeCompare(b.time));
}
// js/timetable.js の末尾付近に追加

/**
 * 共通 stop_id を持つ全会社の時刻表を取得し、結合して表示する
 */
async function showUnifiedTimetable(stopId, companyIds, elementId) {
    const container = document.getElementById(elementId);
    
    // 全会社分の時刻表を並列で取得
    const promises = companyIds.map(companyId => getTimetableForStop(stopId, companyId));
    const results = await Promise.all(promises);

    // 全社のデータを一つの配列に合体
    let combined = [];
    results.forEach(list => {
        combined = combined.concat(list);
    });

    // 時間順にソート
    combined.sort((a, b) => a.time.localeCompare(b.time));

    if (combined.length === 0) {
        container.innerHTML = `<strong>${container.querySelector('strong').innerText}</strong><br><hr>運行予定はありません`;
        return;
    }

    // HTMLの組み立て
    let html = `<strong>${container.querySelector('strong').innerText}</strong><br><hr>`;
    html += `<div style="max-height:200px; overflow-y:auto;">`;
    html += `<table style="width:100%; font-size:12px; border-collapse:collapse;">`;
    
    combined.forEach(item => {
        // 会社ごとに色を変える（広電:黄緑, 広バス:赤）
        const color = (item.companyId === 'hirobus') ? '#e60012' : '#82c91e';
        html += `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:4px 0;">${item.time}</td>
            <td style="padding:4px 2px;"><span style="background:${color}; color:#fff; padding:1px 3px; border-radius:3px;">${item.routeNo}</span></td>
            <td style="padding:4px 0;">${item.headsign}</td>
        </tr>`;
    });
    
    html += `</table></div>`;
    container.innerHTML = html;
}

// 外から呼べるように登録
window.showUnifiedTimetable = showUnifiedTimetable;
window.getTimetableForStop = getTimetableForStop;
