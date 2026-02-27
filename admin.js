// === 核心数据词典 ===
const regularItems = [
    { key: 'particle', name: '悬浮粒子' }, { key: 'pressure', name: '静压差' },
    { key: 'air', name: '换气次数/风速' }, { key: 'temphum', name: '温湿度' },
    { key: 'noise', name: '噪声' }, { key: 'lux', name: '照度' },
    { key: 'planktonic', name: '浮游菌' }, { key: 'settling', name: '沉降菌' }
];
const specialItems = [
    { key: 'vibration', name: '振动' }, { key: 'recovery', name: '自净时间' },
    { key: 'airflow', name: '气流流型' }, { key: 'leakage', name: '高效检漏' },
    { key: 'uv', name: '紫外灯辐射强度' }, { key: 'surface', name: '表面微生物' }
];
const testItems = [...regularItems, ...specialItems];

const combinedLevels = [
    "5级", "6级", "7级", "8级", "9级",
    "100级", "1000级", "10000级", "100000级", "300000级",
    "I级", "II级", "III级", "IV级",
    "A级", "B级", "C级", "D级"
];

const levelGroups = [
    { name: "🔢 国际 ISO 标准", keys: ["5级", "6级", "7级", "8级", "9级"] },
    { name: "🏭 国标常规/旧版", keys: ["100级", "1000级", "10000级", "100000级", "300000级"] },
    { name: "💊 GMP 医药及生安", keys: ["A级", "B级", "C级", "D级"] },
    { name: "🏥 医院手术室专用", keys: ["I级", "II级", "III级", "IV级"] }
];

window.onload = function () {
    const adminSelect = document.getElementById('adminClassLevel');
    adminSelect.innerHTML = "";
    combinedLevels.forEach(lvl => {
        const opt = document.createElement('option');
        opt.value = lvl; opt.text = lvl;
        adminSelect.appendChild(opt);
    });

    loadAdminPricesToUI();
};

function buildDefaultPrices() {
    let defaultData = {};
    combinedLevels.forEach(level => {
        defaultData[level] = {};
        testItems.forEach(item => {
            defaultData[level][item.key] = { threshold: 10, pBelow: 100, pAbove: 80 };
        });
    });
    return defaultData;
}

function getSystemPrices() {
    // 依然借用同样的 LocalStorage Key 方便测试和预览，真正拆分后也不冲突
    const saved = localStorage.getItem('cleanroomPricesV10');
    if (saved) {
        return { ...buildDefaultPrices(), ...JSON.parse(saved) };
    }
    return buildDefaultPrices();
}

function loadAdminPricesToUI() {
    const level = document.getElementById('adminClassLevel').value;
    const allPrices = getSystemPrices();
    const currentConfig = allPrices[level];
    const tbody = document.getElementById('adminPriceBody');
    tbody.innerHTML = '';

    testItems.forEach(item => {
        const config = currentConfig[item.key];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${item.name}</b></td>
            <td><input type="number" id="th_${item.key}" value="${config.threshold}"></td>
            <td><input type="number" id="pb_${item.key}" value="${config.pBelow}"></td>
            <td><input type="number" id="pa_${item.key}" value="${config.pAbove}"></td>
        `;
        tbody.appendChild(tr);
    });
}

function fillDownColumn(prefix) {
    const firstInput = document.getElementById(`${prefix}_${testItems[0].key}`);
    if (!firstInput) return;
    const fillValue = firstInput.value;
    testItems.forEach(item => {
        const input = document.getElementById(`${prefix}_${item.key}`);
        if (input) input.value = fillValue;
    });
}

function saveAdminPrices(silent = false) {
    const level = document.getElementById('adminClassLevel').value;
    let allPrices = getSystemPrices();
    testItems.forEach(item => {
        allPrices[level][item.key] = {
            threshold: parseInt(document.getElementById(`th_${item.key}`).value) || 0,
            pBelow: parseFloat(document.getElementById(`pb_${item.key}`).value) || 0,
            pAbove: parseFloat(document.getElementById(`pa_${item.key}`).value) || 0
        };
    });
    localStorage.setItem('cleanroomPricesV10', JSON.stringify(allPrices));
    if (!silent) alert(`【${level}】 的阶梯单价配置已暂存到管理员浏览器！`);
    return allPrices;
}

// === 高级分类复制弹窗逻辑 ===
function openCopyModal() {
    const currentLvl = document.getElementById('adminClassLevel').value;
    document.getElementById('copyModal').style.display = 'flex';
    document.getElementById('chkAllLevels').checked = false;

    const container = document.getElementById('levelGroupsContainer');
    container.innerHTML = '';

    levelGroups.forEach(grp => {
        let groupHtml = `<div class="lvl-group">
            <div class="lvl-group-title">
                <span>${grp.name}</span>
                <label style="font-weight:normal; font-size:12px; cursor:pointer; color:#3b82f6;"><input type="checkbox" onchange="toggleGroupModalLevels(this, '${grp.name}')"> 此组全选</label>
            </div>
            <div class="lvl-grid" data-group="${grp.name}">`;

        grp.keys.forEach(k => {
            let isCurrent = (k === currentLvl);
            let disabledStr = isCurrent ? 'disabled' : '';
            let textStr = isCurrent ? `<span style="color:#94a3b8; font-style:italic;">${k} (当前)</span>` : k;
            groupHtml += `<label class="lvl-label"><input type="checkbox" class="chk-modal-lvl" value="${k}" ${disabledStr}> ${textStr}</label>`;
        });
        groupHtml += `</div></div>`;
        container.innerHTML += groupHtml;
    });
}

function closeCopyModal() {
    document.getElementById('copyModal').style.display = 'none';
}

function toggleAllModalLevels(cb) {
    document.querySelectorAll('.chk-modal-lvl:not(:disabled)').forEach(input => input.checked = cb.checked);
    document.querySelectorAll('.lvl-group-title input[type="checkbox"]').forEach(input => input.checked = cb.checked);
}

function toggleGroupModalLevels(cb, groupName) {
    const grid = document.querySelector(`.lvl-grid[data-group="${groupName}"]`);
    if (grid) {
        grid.querySelectorAll('.chk-modal-lvl:not(:disabled)').forEach(input => input.checked = cb.checked);
    }
}

function executeCopy() {
    const checkedBoxes = document.querySelectorAll('.chk-modal-lvl:checked:not(:disabled)');
    if (checkedBoxes.length === 0) {
        alert("请至少选择一个目标级别！");
        return;
    }

    const currentLvl = document.getElementById('adminClassLevel').value;
    const targetLevels = Array.from(checkedBoxes).map(cb => cb.value);

    let allPrices = getSystemPrices();
    let sourceConfig = {};
    testItems.forEach(item => {
        sourceConfig[item.key] = {
            threshold: parseInt(document.getElementById(`th_${item.key}`).value) || 0,
            pBelow: parseFloat(document.getElementById(`pb_${item.key}`).value) || 0,
            pAbove: parseFloat(document.getElementById(`pa_${item.key}`).value) || 0
        };
    });

    // 保存当前级别
    allPrices[currentLvl] = JSON.parse(JSON.stringify(sourceConfig));

    // 复制给其他级别
    targetLevels.forEach(l => {
        allPrices[l] = JSON.parse(JSON.stringify(sourceConfig));
    });

    localStorage.setItem('cleanroomPricesV10', JSON.stringify(allPrices));
    closeCopyModal();
    alert(`当前规则已保存，并成功复制到 ${targetLevels.length} 个其它级别中！`);
}

// === 核心机制：混淆打包加密并导出 ===
function exportEncryptedConfig() {
    // 强制自动保存一次保证数据最新
    const allPrices = saveAdminPrices(true);

    // 增加数据混淆时间戳标记
    const payload = {
        sign: "CLEANROOM_CONFIG_X1",
        timestamp: new Date().getTime(),
        data: allPrices
    };

    // 简单粗暴的 Base64 编码进行文件混淆，防止被非技术人员肉眼看懂JSON
    const jsonString = JSON.stringify(payload);
    // encodeURIComponent 处理中文避免 btoa 报错
    const encodedData = btoa(encodeURIComponent(jsonString));

    // 生成当前日期文件名: 20260228
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const filename = `${dateStr}单价同步包.crm`; // .crm (cleanroom config) 伪装成专业后缀，防手贱点开

    const blob = new Blob([encodedData], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// === 管理员导入还原机制 ===
function importAdminEncryptedConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const fileContent = e.target.result;
            const rawJsonString = decodeURIComponent(atob(fileContent));
            const parsedData = JSON.parse(rawJsonString);

            if (parsedData.sign !== "CLEANROOM_CONFIG_X1" || !parsedData.data) {
                alert("导入失败：非本平台派发的有效价格配置包。");
                return;
            }

            // 直接覆写本地 Admin 全局配置
            localStorage.setItem('cleanroomPricesV10', JSON.stringify(parsedData.data));

            // 刷新UI
            loadAdminPricesToUI();

            alert(`✅ 已成功解析并导入您选择的旧版价格包！现在您可以基于它在此继续二次编辑。`);

        } catch (error) {
            alert("读取失败，文件可能已损坏或被强制篡改。");
            console.error(error);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}
