// js/gtfs_loader.js

// --- 最初に必ず初期化する ---
window.stopLookup = {}; 
window.tripLookup = {};
window.routeLookup = {};
window.routeJpLookup = {};
window.gtfsCache = {};
window.isGtfsReady = false;

async function prepareAllGtfsData() {
    console.log("🚀 起動プロセス: 最小限のデータ(stops.txtのみ)で開始します");
    
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
                    const stopId = cols[sIdIdx].trim();
                    // ここでエラーは起きなくなります
                    window.stopLookup[stopId] = { name: cols[sNameIdx] || "名称不明" };
                }
            }
            console.log(`✅ ${company.name} の停留所配置完了`);
        } catch (e) {
            console.error(`${company.name} の起動読込失敗:`, e);
        }
    }
    window.isGtfsReady = true; 
}

// 実行
prepareAllGtfsData();
