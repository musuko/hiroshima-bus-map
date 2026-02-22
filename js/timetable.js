// 他のファイルと競合しないように window に持たせる
window.timetableCache = window.timetableCache || {};
const timetableCache = window.timetableCache;

/**
 * 以前はここにあった prepareGtfsData は、
 * gtfs_loader.js が全社分を一括で行うようになったため、
 * このファイルからは削除（または loader に統合）するのがスッキリします。
 */

async function getTimetableForStop(stopId, companyId = 'hiroden') {
    // gtfs_loader.js の準備が終わるのを待つ
    while(!window.isGtfsReady) await new Promise(r => setTimeout(r, 100));

    // キャッシュキーを「会社名_バス停ID」にして衝突を防ぐ
    const cacheKey = `${companyId}_${stopId}`;
    if (timetableCache[cacheKey]) {
        console.log(`⚡ キャッシュから取得中: ${cacheKey}`);
        return filterAndProcessTimetable(timetableCache[cacheKey], companyId);
    }

    try {
        // config.js の設定から、対象の会社のパスを取得
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) throw new Error(`会社ID ${companyId} が見つかりません`);

        console.log(`🔍 ${company.name} のファイルをスキャン中... stop_id: ${stopId}`);
        const response = await fetch(`${company.staticPath}stop_times.txt`);
        if (!response.ok) throw new Error("stop_times.txtが見つかりません");

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
                const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

                if (isFirstChunk) {
                    idxTripId = columns.indexOf('trip_id');
                    idxDepTime = columns.indexOf('departure_time');
                    idxStopId = columns.indexOf('stop_id');
                    isFirstChunk = false;
                    continue;
                }

                if (columns[idxStopId] === stopId) {
                    stopSpecificData.push({
                        tripId: columns[idxTripId], // 生のID
                        depTime: columns[idxDepTime]
                    });
                }
            }
        }

        timetableCache[cacheKey] = stopSpecificData;
        return filterAndProcessTimetable(stopSpecificData, companyId);

    } catch (error) {
        console.error("時刻表読み込みエラー:", error);
        return [];
    }
}

/**
 * フィルタリングと加工（プレフィックス対応）
 */
function filterAndProcessTimetable(data, companyId) {
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    return data
        .filter(item => {
            const t = item.depTime;
            return t >= currentTimeStr || t.startsWith('24') || t.startsWith('25');
        })
        .map(item => {
            // loader側で付けたプレフィックスを考慮して検索
            const globalTripId = `${companyId}_${item.tripId}`;
            const globalRouteId = window.tripLookup[globalTripId];
            const jpInfo = window.routeJpLookup[globalRouteId];
            const routeInfo = window.routeLookup[globalRouteId] || { no: "??", name: "不明" };
            
            let headsign = routeInfo.name;

            // ループ判定ロジック
            if (jpInfo) {
                const origin = (jpInfo.origin || "").trim();
                const dest = (jpInfo.dest || "").trim();
                const parentIdName = (jpInfo.jp_parent_route_id || "").trim();

                if (origin === dest && parentIdName !== "") {
                    headsign = parentIdName;
                }
            }

            return {
                time: item.depTime.substring(0, 5),
                routeNo: routeInfo.no,
                headsign: headsign,
                companyId: companyId // 表示時に会社ロゴを分ける場合に便利
            };
        })
        .sort((a, b) => a.time.localeCompare(b.time));
}

window.getTimetableForStop = getTimetableForStop;
