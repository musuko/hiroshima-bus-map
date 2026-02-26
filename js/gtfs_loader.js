/**
 * js/gtfs_loader.js
 * 役割: 「バス停名」と「系統情報」をメモリに読み込む
 */

window.stopLookup = window.stopLookup || {}; 
window.tripLookup = window.tripLookup || {};
window.routeLookup = window.routeLookup || {}; 
window.routeJpLookup = window.routeJpLookup || {};
window.isGtfsReady = false;

// ★1つの会社のデータだけを読み込む関数
window.loadCompanyGtfsData = async function(company) {
    if (company.isGtfsLoaded) return; // 既にロード済みならスキップ

    console.log(`🚀 ${company.name} のGTFSデータを読み込み中...`);
    
    // --- A. stops.txt の読み込み ---
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
        }
    } catch (e) { console.error(`${company.name} stops.txt 読込失敗:`, e); }

    // --- B. routes.txt の読み込み ---
    try {
        const res = await fetch(`${company.staticPath}routes.txt`);
        if (res.ok) {
            const text = await res.text();
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            
            const rIdIdx = head.indexOf('route_id');
            const rShortIdx = head.indexOf('route_short_name');
            const rLongIdx = head.indexOf('route_long_name');

            window.routeLookup[company.id] = {};

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (cols.length > rIdIdx && cols[rIdIdx]) {
                    const routeId = cols[rIdIdx].trim();
                    window.routeLookup[company.id][routeId] = {
                        shortName: cols[rShortIdx] || "",
                        longName: cols[rLongIdx] || "路線情報なし"
                    };
                }
            }
        }
    } catch (e) { console.error(`${company.name} routes.txt 読込失敗:`, e); }

    company.isGtfsLoaded = true; // 読み込み完了フラグを立てる
};

// ★起動時に呼び出される関数（表示ONの会社だけをロードする）
window.prepareAllGtfsData = async function() {
    const promises = window.BUS_COMPANIES
        .filter(c => c.active && c.visible !== false) // 表示ONの会社のみ
        .map(c => window.loadCompanyGtfsData(c));
    
    await Promise.all(promises);
    window.isGtfsReady = true; 
    console.log("🏁 初期のGTFSデータロードが完了しました");
};
