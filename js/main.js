/**
 * スマホの回転方向と位置を物理法則に合わせる。
 */
function syncHeaderWithOrientation() {
    const body = document.body;
    const header = document.querySelector('.header');
    const headerText = document.querySelector('.header-text');
    const mapContainer = document.getElementById('map');
    if (!header || !headerText || !mapContainer) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // PC（幅1024以上）または縦持ちは常に「上ヘッダー」
    if (width >= 1024 || height > width) {
        body.style.flexDirection = "column";
        header.style.width = "100%";
        header.style.height = "50px";
        header.style.lineHeight = "50px";
        headerText.style.transform = "none";
        
        // 地図の幅をリセット
        mapContainer.style.width = "100%";
    } else {
        // --- スマホ横持ち ---
        let angle = window.orientation || (window.screen.orientation && window.screen.orientation.angle) || 0;

        header.style.width = "40px";
        header.style.height = "100vh";
        header.style.lineHeight = "normal";

        // 地図の幅を「ヘッダー分を引いた残り」に明示的に固定
        mapContainer.style.width = "calc(100vw - 40px)";

        // 【最終修正：物理配置】
        // スマホを時計回りに倒すと、ブラウザは「90度」を返しますが、
        // あなたの端末ではこれが「左」を指している可能性があるため、逆転させます。
        if (angle === 90) {
            body.style.flexDirection = "row"; // ヘッダーを左配置
            headerText.style.transform = "rotate(-90deg)";
            header.style.borderRight = "1px solid #ddd";
            header.style.borderLeft = "none";
        } else {
            body.style.flexDirection = "row-reverse"; // ヘッダーを右配置
            headerText.style.transform = "rotate(90deg)";
            header.style.borderLeft = "1px solid #ddd";
            header.style.borderRight = "none";
        }
    }

    // 地図の描画崩れ（半分グレー）を防ぐため、サイズを再計算
    if (window.map) {
        setTimeout(() => {
            window.map.invalidateSize();
        }, 300); // 余裕を持って300ms待機
    }
}

/**
 * 会社選択モーダルの制御と設定保存
 */
function setupCompanyFilter() {
    const btnOpen = document.getElementById('btn-company-filter');
    const modal = document.getElementById('company-modal');
    const btnClose = document.getElementById('btn-close-modal');
    const btnCheckAll = document.getElementById('btn-check-all');
    const btnUncheckAll = document.getElementById('btn-uncheck-all');
    const companyList = document.getElementById('company-list');

    if (!btnOpen || !modal) return;

    // 1. 保存された設定（localStorage）があれば復元する
    const savedConfig = localStorage.getItem('busVisibleConfig');
    if (savedConfig) {
        try {
            const parsed = JSON.parse(savedConfig);
            window.BUS_COMPANIES.forEach(c => {
                if (parsed[c.id] !== undefined) {
                    c.visible = parsed[c.id]; // 以前のチェック状態を復元
                }
            });
        } catch(e) { console.error("設定の復元に失敗:", e); }
    }

    // 2. チェックボックスのリストを作成
    function renderCheckboxes() {
        companyList.innerHTML = '';
        window.BUS_COMPANIES.forEach(company => {
            const label = document.createElement('label');
            label.style.display = "block";
            label.style.margin = "15px 0";
            label.style.fontSize = "1.2em";

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = company.id;
            // 未設定なら true (チェックあり)
            checkbox.checked = company.visible !== false; 
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${company.name}`));
            companyList.appendChild(label);
        });
    }

    // 開くボタン
    btnOpen.addEventListener('click', () => {
        renderCheckboxes();
        modal.style.display = 'flex'; // モーダルを表示
    });

    // 全選択 / 全解除
    btnCheckAll.addEventListener('click', () => {
        companyList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    });
    btnUncheckAll.addEventListener('click', () => {
        companyList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    });

    // 決定して閉じるボタン
    btnClose.addEventListener('click', () => {
        modal.style.display = 'none';
        
        // 3. チェック状態をBUS_COMPANIESと保存用データに反映
        const saveObj = {};
        companyList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            const company = window.BUS_COMPANIES.find(c => c.id === cb.value);
            if (company) {
                company.visible = cb.checked;
                saveObj[company.id] = cb.checked;
            }
        });

        // スマホ本体に設定を保存！次回起動時もこの状態になります
        localStorage.setItem('busVisibleConfig', JSON.stringify(saveObj));

        // 4. マップの表示を即座に更新する
        if (typeof window.updateStopsDisplay === 'function') {
            window.updateStopsDisplay();
        }
        if (typeof window.updateBusPositions === 'function') {
            window.updateBusPositions();
        }
    });
}

// 起動シーケンス
window.addEventListener('load', async () => {
    // 1. レイアウト初期化
    syncHeaderWithOrientation();
    setupCompanyFilter(); // ★これを追加してモーダルを有効化

    // 2. 現在地の取得（エラーで止まらないようtry-catch）
    try {
        if (typeof window.startGeolocation === 'function') {
            window.startGeolocation();
        }
    } catch (e) { console.error("現在地エラー:", e); }

    // 3. データ読み込み
    if (typeof window.prepareGtfsData === 'function') {
        await window.prepareGtfsData();
    }

    // 4. バス更新
    if (window.map && typeof window.updateBusPositions === 'function') {
        window.updateBusPositions();
        setInterval(() => window.updateBusPositions(), 15000);
    }
});

window.addEventListener('resize', syncHeaderWithOrientation);
window.addEventListener('orientationchange', syncHeaderWithOrientation);
