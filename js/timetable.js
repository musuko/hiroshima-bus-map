// js/timetable.js
// js/timetable.js

let tripLookup = {};   // { trip_id: route_id }
let routeLookup = {};  // { route_id: { number: route_short_name, name: route_long_name } }

async function prepareGtfsData() {
    try {
        // 1. routes.txt から 路線番号 と 路線名（行先） を読み込む
        const rRes = await fetch('./hiroden/routes.txt');
        const rText = await rRes.text();
        rText.split(/\r?\n/).slice(1).forEach(line => {
            const c = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (c.length >= 4) {
                routeLookup[c[0]] = {
                    number: c[2], // route_short_name (例: 3)
                    name: c[3]    // route_long_name (例: 広島駅～観音本町)
                };
            }
        });

        // 2. trips.txt から 便ID と 路線ID の紐付けを作る
        const tRes = await fetch('./hiroden/trips.txt');
        const tText = await tRes.text();
        tText.split(/\r?\n/).slice(1).forEach(line => {
            const c = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (c.length >= 3) {
                // trip_id (c[2]) をキーにして route_id (c[0]) を保存
                tripLookup[c[2]] = c[0];
            }
        });
        console.log("GTFS辞書（route_long_name版）準備完了");
    } catch (e) {
        console.error("辞書作成エラー:", e);
    }
}

// 既存の getTimetableForStop 内の解析部分を以下のように修正
// (timetable.push する箇所)
/*
    const routeId = tripLookup[tripId];
    const routeInfo = routeLookup[routeId] || {};

    timetable.push({
        time: depTime,
        routeNo: routeInfo.number || "",
        headsign: routeInfo.name || "不明"
    });
*/

// ページ読み込み時に一度だけ実行
prepareGtfsData();

// js/timetable.js (修正版)

async function getTimetableForStop(stopId) {
    const txtPath = './hiroden/stop_times.txt'; // txtに変更
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

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
                    
                    if (columns[3] === stopId) {
                        const tripId = columns[0]; // trip_id
                        const depTime = columns[2]; // departure_time
                        
                        if (depTime >= currentTimeStr) {
                            // 辞書から情報を引く
                            const tripInfo = tripLookup[tripId] || {};
                            const routeNo = routeLookup[tripInfo.routeId] || "";
                            const headsign = tripInfo.headsign || "不明";

                            timetable.push({
                                time: depTime,
                                routeNo: routeNo,
                                headsign: headsign
                            });
                        }
                    }
                }
            }
        }

        // 時刻順に並び替え（オブジェクトなので sort の書き方が少し変わります）
        return timetable.sort((a, b) => a.time.localeCompare(b.time));

    } catch (error) {
        console.error('時刻表読込エラー:', error);
        return [];
    }
}
