/**
 * 画面の回転角に応じて、ヘッダーの位置と文字の向きを同期させる
 */
function syncHeaderWithOrientation() {
    const body = document.body;
    const header = document.querySelector('.header');
    const headerText = document.querySelector('.header-text');
    if (!header || !headerText) return;

    // モバイル端末（タッチ操作可能）かつ、横長画面の場合のみ実行
    const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isLandscape = window.innerWidth > window.innerHeight;

    if (isMobile && isLandscape) {
        // --- スマホ横持ち時の特殊レイアウト ---
        let angle = 0;
        if (window.screen && window.screen.orientation) {
            angle = window.screen.orientation.angle;
        } else if (typeof window.orientation !== 'undefined') {
            angle = window.orientation;
        }

        body.style.flexDirection = "row"; 

        if (angle === 90) {
            // 時計回り（右端ヘッダー）
            header.style.order = "1";
            header.style.width = "40px";
            header.style.height = "100vh";
            headerText.style.transform = "rotate(90deg)";
        } else {
            // 反時計回り（左端ヘッダー）
            header.style.order = "0";
            header.style.width = "40px";
            header.style.height = "100vh";
            headerText.style.transform = "rotate(-90deg)";
        }
        header.style.lineHeight = "normal";
    } else {
        // --- PC または 縦持ち時の標準レイアウト ---
        body.style.flexDirection = "column";
        header.style.order = "";
        header.style.width = "100%";
        header.style.height = "50px";
        header.style.lineHeight = "50px";
        headerText.style.transform = "none";
    }

    // 地図のサイズ更新
    if (window.map) {
        window.map.invalidateSize();
    }
}

// 既存の load イベントに統合してバスの描画を邪魔しないようにする
window.addEventListener('load', async () => {
    console.log("🚀 アプリ起動シーケンス開始");

    // 1. まずGTFSデータを準備（これを先に完了させる）
    if (typeof window.prepareGtfsData === 'function') {
        await window.prepareGtfsData();
        console.log("✅ GTFSデータ準備完了");
    }

    // 2. 地図の初期化確認
    if (window.map) {
        // バス停の描画
        if (typeof loadAllStops === 'function') {
            loadAllStops();
        }

        // バス位置の初回描画と定期更新の開始
        if (typeof window.updateBusPositions === 'function') {
            window.updateBusPositions();
            setInterval(() => window.updateBusPositions(), 15000);
            console.log("✅ バス位置更新開始");
        }

        // 3. 全ての描画準備が整ってから、現在地の追跡とレイアウト調整を実行
        if (typeof window.startGeolocation === 'function') {
            window.startGeolocation();
        }

        // 最後にレイアウト調整（0.5秒だけ待って地図を安定させる）
        setTimeout(() => {
            syncHeaderWithOrientation();
            console.log("✅ レイアウト調整完了");
        }, 500);

    } else {
        console.error("❌ Mapが初期化されていません");
    }
});

/**
 * スマホの回転方向（重力）に合わせてヘッダー位置と文字向きを同期
 */
function syncHeaderWithOrientation() {
    const body = document.body;
    const header = document.querySelector('.header');
    const headerText = document.querySelector('.header-text');
    if (!header || !headerText) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isLandscape = width > height;
    
    // PC判定（1024px以上はPC）
    const isPC = width >= 1024;

    if (isLandscape && !isPC) {
        let angle = 0;
        if (window.screen && window.screen.orientation) {
            angle = window.screen.orientation.angle;
        } else if (typeof window.orientation !== 'undefined') {
            angle = window.orientation;
        }

        body.style.flexDirection = "row"; 

        // --- 物理的な位置関係に基づいた修正 ---
        if (angle === 90) {
            // 【時計回り】上部にあったヘッダーは物理的に「右端」へ
            header.style.order = "1"; // Map(0) -> Header(1) の順で右配置
            header.style.width = "40px";
            header.style.height = "100vh";
            headerText.style.transform = "rotate(90deg)"; // 文字も右倒し
            header.style.borderLeft = "1px solid #ddd";
            header.style.borderRight = "none";
            
        } else if (angle === -90 || angle === 270) {
            // 【反時計回り】上部にあったヘッダーは物理的に「左端」へ
            header.style.order = "0"; // Header(0) -> Map(1) の順で左配置
            header.style.width = "40px";
            header.style.height = "100vh";
            headerText.style.transform = "rotate(-90deg)"; // 文字も左倒し
            header.style.borderRight = "1px solid #ddd";
            header.style.borderLeft = "none";
        }
        header.style.lineHeight = "normal";
    }

    if (window.map) {
        // 描画の衝突を防ぐため、少し遅らせて実行
        setTimeout(() => {
            window.map.invalidateSize();
        }, 300);
    }
}

// 回転イベント
window.addEventListener('resize', syncHeaderWithOrientation);
window.addEventListener('orientationchange', syncHeaderWithOrientation);
