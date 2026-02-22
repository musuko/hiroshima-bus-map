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
    if (!window.activeServiceIds) return [];

    return data
        .map(item => {
            const globalTripId = `${companyId}_${item.tripId}`;
            const tripData = window.tripLookup[globalTripId];

            if (!tripData) return null;

            // 判定用ログ（あまりに多いと重いので、最初の数件だけ出すなど調整可）
            const isActive = window.activeServiceIds.has(tripData.serviceId);
            
            if (!isActive) return null; 

            const routeId = tripData.routeId;
            const routeInfo = window.routeLookup[routeId] || { no: "??", name: "不明" };
            const jpInfo = window.routeJpLookup[routeId];

            let headsign = item.headsign || routeInfo.name;
            if (jpInfo) {
                const dest = (jpInfo.dest || "").trim();
                headsign = dest ? `${dest} 行` : headsign;
            }

            return {
                time: item.depTime.substring(0, 5),
                routeNo: routeInfo.no,
                headsign: headsign,
                companyId: companyId
            };
        })
        .filter(item => item !== null)
        // 一旦、現在時刻フィルターをコメントアウトして「今日の全便」を表示させてみます
        // .filter(item => {
        //    const now = new Date();
        //    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        //    return item.time >= currentTime;
        // })
        .sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * 共通 stop_id を持つ全会社の時刻表を結合して表示
 */
async function showUnifiedTimetable(stopId, companyIds, elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;

    try {
        // 各会社の時刻表を取得して処理
        const promises = companyIds.map(async (companyId) => {
            const rawData = await getTimetableForStop(stopId, companyId);
            return filterAndProcessTimetable(rawData, companyId);
        });

        const results = await Promise.all(promises);
        let combined = results.flat(); // 全社分を一つの配列に

        // 時間順にソート
        combined.sort((a, b) => a.time.localeCompare(b.time));

        if (combined.length === 0) {
            container.innerHTML = `<strong>${container.querySelector('strong').innerText}</strong><br><hr>本日の運行予定はありません`;
            return;
        }

        // HTML表示の組み立て
        let html = `<strong>${container.querySelector('strong').innerText}</strong><br><hr>`;
        html += `<div style="max-height:250px; overflow-y:auto;">`;
        html += `<table style="width:100%; font-size:12px; border-collapse:collapse;">`;
        
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
        console.error("時刻表表示エラー:", e);
        container.innerHTML = "時刻表の読み込み中にエラーが発生しました。";
    }
}

window.showUnifiedTimetable = showUnifiedTimetable;
window.getTimetableForStop = getTimetableForStop;
