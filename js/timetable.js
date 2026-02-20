// js/timetable.js
let tripLookup = {};
let routeLookup = {};
let isGtfsReady = false;

async function prepareGtfsData() {
    try {
        const rRes = await fetch('./hiroden/routes.txt');
        const rText = await rRes.text();
        const rRows = rText.trim().split(/\r?\n/).map(row => row.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
        const rHead = rRows[0];
        
        console.log("--- routes.txt ヘッダー ---", rHead);

        rRows.slice(1).forEach(cols => {
            if (cols.length > 1) {
                // route_id, route_short_name, route_long_name の位置を自動特定
                routeLookup[cols[rHead.indexOf('route_id')]] = {
                    number: cols[rHead.indexOf('route_short_name')],
                    name: cols[rHead.indexOf('route_long_name')]
                };
            }
        });

        const tRes = await fetch('./hiroden/trips.txt');
        const tText = await tRes.text();
        const tRows = tText.trim().split(/\r?\n/).map(row => row.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
        const tHead = tRows[0];

        console.log("--- trips.txt ヘッダー ---", tHead);

        tRows.slice(1).forEach(cols => {
            if (cols.length > 1) {
                // trip_id をキーにして route_id を保存
                tripLookup[cols[tHead.indexOf('trip_id')]] = cols[tHead.indexOf('route_id')];
            }
        });

        isGtfsReady = true;
        console.log("辞書準備完了: routeLookup数", Object.keys(routeLookup).length, "tripLookup数", Object.keys(tripLookup).length);
    } catch (e) {
        console.error("準備フェーズでエラー:", e);
    }
}

prepareGtfsData();

async function getTimetableForStop(stopId) {
    const txtPath = './hiroden/stop_times.txt';
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    try {
        const response = await fetch(txtPath);
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let timetable = [];

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split(/\r?\n/);
            partialData = lines.pop();

            for (const line of lines) {
                if (line.includes(stopId)) {
                    const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    
                    // stop_id 一致確認
                    if (columns[3] === stopId) {
                        const tripId = columns[0];
                        const routeId = tripLookup[tripId];
                        const routeInfo = routeLookup[routeId];

                        // 特定のバス停IDの場合のみ詳細ログを出す
                        if (stopId === "51550 2") {
                            console.group(`バス停デバッグ: ${stopId}`);
                            console.log("1. この行の生データ:", columns);
                            console.log("2. 抽出した tripId:", tripId);
                            console.log("3. 辞書から引いた routeId:", routeId);
                            console.log("4. 辞書から引いた routeInfo:", routeInfo);
                            console.groupEnd();
                        }

                        if (columns[2] >= currentTimeStr) {
                            timetable.push({
                                time: columns[2],
                                routeNo: routeInfo ? routeInfo.number : "未定義",
                                headsign: routeInfo ? routeInfo.name : "不明"
                            });
                        }
                    }
                }
            }
        }
        return timetable.sort((a, b) => a.time.localeCompare(b.time));
    } catch (error) {
        console.error('読込失敗:', error);
        return [];
    }
}
