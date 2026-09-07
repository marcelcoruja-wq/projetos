/* cloud.js - Sincronização Estável sem Limite de Payload */
const CLOUD_TOKEN_KEY = 'cloud_gist_token';
const CLOUD_ID_KEY = 'cloud_gist_id';

const MODULE_KEYS = [
    'persistence_engine_data_v1', // Planejador / Rotina
    'projects_engine_data_v1',    // Gestor de Projetos
    'personalFinanceData',        // Finanças Pessoais
    'pomodoro_engine_data_v1'     // Pomodoro
];

function hasContent(obj) {
    if (!obj || typeof obj !== 'object') return false;
    return Object.keys(obj).length > 0;
}

function mergeFinanceData(local, remote) {
    if (!hasContent(remote)) return local || {};
    if (!hasContent(local)) return remote || {};

    const merged = { ...remote, ...local };
    const arrayKeys = ['transactions', 'savings', 'debts', 'apeExpenses', 'favors'];

    arrayKeys.forEach(arrKey => {
        const localArr = Array.isArray(local[arrKey]) ? local[arrKey] : [];
        const remoteArr = Array.isArray(remote[arrKey]) ? remote[arrKey] : [];

        const map = new Map();
        remoteArr.forEach(item => { if (item && item.id) map.set(String(item.id), item); });
        localArr.forEach(item => { if (item && item.id) map.set(String(item.id), item); });

        merged[arrKey] = Array.from(map.values());
    });

    return merged;
}

async function cloudPull() {
    const token = localStorage.getItem(CLOUD_TOKEN_KEY);
    const gistId = localStorage.getItem(CLOUD_ID_KEY);

    if (!token || !gistId) return false;

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return false;

        const gistData = await res.json();
        const content = gistData.files['dados.json']?.content;

        if (content && content !== '{}') {
            const parsed = JSON.parse(content);
            let hasLocalAdditions = false;

            MODULE_KEYS.forEach(key => {
                const remoteObj = parsed[key];
                const rawLocal = localStorage.getItem(key);
                const localObj = rawLocal ? JSON.parse(rawLocal) : null;

                if (key === 'personalFinanceData') {
                    const mergedFinance = mergeFinanceData(localObj, remoteObj);
                    if (hasContent(mergedFinance)) {
                        localStorage.setItem(key, JSON.stringify(mergedFinance));
                    }
                    if (hasContent(localObj) && (!hasContent(remoteObj) || JSON.stringify(localObj) !== JSON.stringify(remoteObj))) {
                        hasLocalAdditions = true;
                    }
                } else {
                    if (hasContent(remoteObj)) {
                        localStorage.setItem(key, JSON.stringify(remoteObj));
                    } else if (hasContent(localObj)) {
                        hasLocalAdditions = true;
                    }
                }
            });

            if (hasLocalAdditions) {
                await cloudPush();
            }
            return true;
        }
    } catch (e) {
        console.error("Erro no Cloud Pull:", e);
    }
    return false;
}

async function cloudPush() {
    const token = localStorage.getItem(CLOUD_TOKEN_KEY);
    const gistId = localStorage.getItem(CLOUD_ID_KEY);

    if (!token || !gistId) return false;

    const payload = {};
    MODULE_KEYS.forEach(key => {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
            try {
                payload[key] = JSON.parse(raw);
            } catch(e) {
                payload[key] = {};
            }
        } else {
            payload[key] = {};
        }
    });

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'dados.json': { content: JSON.stringify(payload, null, 2) }
                }
            })
        });

        if (res.ok) {
            console.log("Sincronização com o Gist realizada com sucesso!");
            return true;
        } else {
            console.error("Erro no Cloud Push (Status HTTP):", res.status);
            return false;
        }
    } catch (e) {
        console.error("Erro no Cloud Push:", e);
        return false;
    }
}
