// js/timetable.js
let tripLookup = {};
let routeLookup = {};
let routeJpLookup = {};
let isGtfsReady = false;

// 【高速化】一度読み込んだバス停の全データをメモリに保持するキャッシュ
const timetableCache = {};

async function prepareGtfsData() {
    try {
        const [rRes, tRes, rJpRes] = await Promise.all([
            fetch('./info/hiroden/routes.txt'),
            fetch('./info/hiroden/trips.txt'),
            fetch('./info/hiroden/routes_jp.txt')
        ]);
        
        const rText = await rRes.text();
        const tText = await tRes.text();
        const rJpText = await rJpRes.text();

        // routes.txt 解析
        const rRows = rText.trim().split(/\r?\n/);
        const rHead = rRows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        rRows.slice(1).forEach(row => {
            const c = row.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            routeLookup[c[rHead.indexOf('route_id')]] = {
                no: c[rHead.indexOf('route_short_name')],
                name: c[rHead.indexOf('route_long_name')]
            };
        });

        // trips.txt 解析
        const tRows = tText.trim().split(/\r?\n/);
        const tHead = tRows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        tRows.slice(1).forEach(row => {
            const c = row.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            tripLookup[c[tHead.indexOf('trip_id')]] = c[tHead.indexOf('route_id')];
        });

        // routes_jp.txt 解析 (ループ判定用データ取得)
        const rJpRows = rJpText.trim().split(/\r?\n/);
        const rJpHead = rJpRows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        rJpRows.slice(1).forEach(row => {
            const c = row.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (c.length > 1) {
                routeJpLookup[c[rJpHead.indexOf('route_id')]] = {
                    origin: c[rJpHead.indexOf('origin_stop')],
                    dest: c[rJpHead.indexOf('destination_stop')],
                    jp_parent_route_id: c[rJpHead.indexOf('jp_parent_route_id')]
                };
            }
        });
        
        window.routeJpLookup = routeJpLookup;
        window.tripLookup = tripLookup;
        window.routeLookup = routeLookup;

        isGtfsReady = true;
        console.log("✅ 全GTFS辞書準備完了");
    } catch (e) {
        console.error("辞書作成エラー:", e);
    }
}
prepareGtfsData();

async function getTimetableForStop(stopId) {
    while(!isGtfsReady) await new Promise(r => setTimeout(r, 100));

    // 【高速化】キャッシュにあれば即座に返す
    if (timetableCache[stopId]) {
        console.log(`⚡ キャッシュから取得中: ${stopId}`);
        return filterAndProcessTimetable(timetableCache[stopId]);
    }

    try {
        console.log(`🔍 巨大ファイルをスキャン中... stop_id: ${stopId}`);
        const response = await fetch('./info/hiroden/stop_times.txt');
        if (!response.ok) throw new Error("stop_times.txtが見つかりません");

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let stopSpecificData = []; // このバス停の全時間帯データを一時保存

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

                // 一致するstop_idの行だけをメモリに貯める
                if (columns[idxStopId] === stopId) {
                    stopSpecificData.push({
                        tripId: columns[idxTripId],
                        depTime: columns[idxDepTime]
                    });
                }
            }
        }

        // キャッシュに保存（全時間帯分）
        timetableCache[stopId] = stopSpecificData;
        
        return filterAndProcessTimetable(stopSpecificData);

    } catch (error) {
        console.error("時刻表読み込みエラー:", error);
        return [];
    }
}

/**
 * 取得した生データを「現在時刻以降」でフィルタリングし、
 * ループ判定などの加工を行ってソートする補助関数
 */
function filterAndProcessTimetable(data) {
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    return data
        .filter(item => {
            const t = item.depTime;
            return t >= currentTimeStr || t.startsWith('24') || t.startsWith('25');
        })
        .map(item => {
            const routeId = tripLookup[item.tripId];
            const jpInfo = routeJpLookup[routeId];
            
            // デフォルトの値をセット
            let displayRouteId = routeId;
            let headsign = routeLookup[routeId] ? routeLookup[routeId].name : "不明";

            // --- ループ判定ロジック (buses.js と統一) ---
            if (jpInfo) {
                const origin = (jpInfo.origin || "").trim();
                const dest = (jpInfo.dest || "").trim();
                const parentIdName = (jpInfo.jp_parent_route_id || "").trim();

                // 起点と終点が同じ、かつ親ID（系統名）が存在する場合
                if (origin === dest && parentIdName !== "") {
                    // 行先表示を親系統名（例：市内6号線...）に差し替える
                    headsign = parentIdName;
                }
            }
            // ------------------------------------------

            const routeInfo = routeLookup[displayRouteId] || { no: "??", name: "不明" };

            return {
                time: item.depTime.substring(0, 5), // HH:mm 形式
                routeNo: routeInfo.no,
                headsign: headsign // 修正した行先をセット
            };
        })
        .sort((a, b) => a.time.localeCompare(b.time));
}

window.getTimetableForStop = getTimetableForStop;
