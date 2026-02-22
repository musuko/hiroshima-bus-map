// js/gtfs_loader.js

// 最初に必ず初期化する
window.stopLookup = {}; 
window.gtfsCache = {};
window.isGtfsReady = false;

async function prepareAllGtfsData() {
    console.log("🚀 起動プロセス: 最小限のデータで開始します");
    
    for (const company of BUS_COMPANIES.filter(c => c.active)) {
        try {
            const res = await fetch(`${company.staticPath}stops.txt`);
            if (!res.ok) continue;
            const text = await res.text();
            
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            const sIdIdx = head.indexOf('stop_id');
            const sNameIdx = head.indexOf('stop_name');

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (cols.length > sIdIdx && cols[sIdIdx]) {
                    // IDの空白などを除去して登録
                    const stopId = cols[sIdIdx].trim();
                    window.stopLookup[stopId] = { name: cols[sNameIdx] || "名称不明" };
                }
            }
            console.log(`✅ ${company.name} の停留所データ準備完了`);
        } catch (e) {
            console.error(`${company.name} の起動読込失敗:`, e);
        }
    }
    window.isGtfsReady = true; 
}

// 起動時に実行
prepareAllGtfsData();

/**
 * 詳細データの遅延ロード用（後ほど使用）
 */
async function loadDetailedGtfsIfNeeded(companyId) {
    if (window.gtfsCache[companyId]) return;
    // ...（必要に応じてここに詳細パース処理を追加）
    window.gtfsCache[companyId] = true;
}
