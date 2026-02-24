/**
 * js/gtfs_loader.js
 * 役割: アプリ起動時に「バス停名」と「系統情報」をメモリに読み込む
 */

// --- 1. 最初に必ず全ての箱を初期化する（他ファイルでのエラー防止） ---
window.stopLookup = {}; 
window.tripLookup = {};
window.routeLookup = {}; // ここに { 会社ID: { 系統ID: {short, long} } } の形で格納
window.routeJpLookup = {};
window.gtfsCache = {};
window.isGtfsReady = false;

async function prepareAllGtfsData() {
    console.log("🚀 起動プロセス: 停留所および系統データの読み込みを開始します");
    
    // config.js で active:true になっている会社をループ
    for (const company of BUS_COMPANIES.filter(c => c.active)) {
        
        // --- A. stops.txt (バス停名) の読み込み ---
        try {
            const res = await fetch(`${company.staticPath}stops.txt`);
            if (res.ok) {
                const text = await res.text();
                const lines = text.trim().split(/\r?\n/);
                const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                const sIdIdx = head.indexOf('stop_id');
                const sNameIdx = head.indexOf('stop_name');

                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    if (cols.length > sIdIdx && cols[sIdIdx]) {
                        const stopId = cols[sIdIdx].trim();
                        window.stopLookup[stopId] = { name: cols[sNameIdx] || "名称不明" };
                    }
                }
                console.log(`✅ ${company.name} の停留所データ読込完了`);
            }
        } catch (e) {
            console.error(`${company.name} stops.txt 読込失敗:`, e);
        }

        // --- B. routes.txt (系統・路線名) の読み込み ---
        try {
            const res = await fetch(`${company.staticPath}routes.txt`);
            if (res.ok) {
                const text = await res.text();
                const lines = text.trim().split(/\r?\n/);
                const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                
                const rIdIdx = head.indexOf('route_id');
                const rShortIdx = head.indexOf('route_short_name');
                const rLongIdx = head.indexOf('route_long_name');

                // 会社ごとの保存場所を作る
                window.routeLookup[company.id] = {};

                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    if (cols.length > rIdIdx && cols[rIdIdx]) {
                        const routeId = cols[rIdIdx].trim();
                        window.routeLookup[company.id][routeId] = {
                            shortName: cols[rShortIdx] || "",        // 系統番号
                            longName: cols[rLongIdx] || "路線情報なし" // 路線名
                        };
                    }
                }
                console.log(`✅ ${company.name} の系統データ読込完了`);
            }
        } catch (e) {
            console.error(`${company.name} routes.txt 読込失敗:`, e);
        }
    }

    window.isGtfsReady = true; 
    console.log("🏁 すべてのプリロードが完了しました");
}

// 実行
prepareAllGtfsData();
