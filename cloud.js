/* cloud.js - Sincronizador Inteligente com Fusão de Dados (Smart Merge) */
const CLOUD_TOKEN_KEY = 'cloud_gist_token';
const CLOUD_ID_KEY = 'cloud_gist_id';

const MODULE_KEYS = [
    'persistence_engine_data_v1', // Planejador / Rotina
    'projects_engine_data_v1',    // Gestor de Projetos
    'personalFinanceData',        // Finanças Pessoais
    'pomodoro_engine_data_v1'     // Pomodoro
];

// Helper para validar se o objeto contém dados reais
function hasData(obj) {
    return obj && typeof obj === 'object' && Object.keys(obj).length > 0;
}

// 1. Puxar dados da nuvem (Sem apagar o localStorage local)
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
            let needsPush = false;

            MODULE_KEYS.forEach(key => {
                const remoteData = parsed[key];
                const localData = JSON.parse(localStorage.getItem(key)) || {};

                if (hasData(remoteData)) {
                    localStorage.setItem(key, JSON.stringify(remoteData));
                } else if (hasData(localData)) {
                    needsPush = true;
                }
            });

            if (needsPush) {
                await cloudPush();
            }
            return true;
        }
    } catch (e) {
        console.error("Erro no Cloud Pull:", e);
    }
    return false;
}

// 2. Enviar para a nuvem fundindo os módulos (Protege contra sobrescrita)
async function cloudPush() {
    const token = localStorage.getItem(CLOUD_TOKEN_KEY);
    const gistId = localStorage.getItem(CLOUD_ID_KEY);

    if (!token || !gistId) return;

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let remoteParsed = {};
        if (res.ok) {
            const gistData = await res.json();
            const content = gistData.files['dados.json']?.content;
            if (content && content !== '{}') {
                remoteParsed = JSON.parse(content);
            }
        }

        const payload = {};

        MODULE_KEYS.forEach(key => {
            const localData = JSON.parse(localStorage.getItem(key)) || {};
            const remoteData = remoteParsed[key] || {};

            if (hasData(localData)) {
                payload[key] = localData;
            } else if (hasData(remoteData)) {
                payload[key] = remoteData;
            } else {
                payload[key] = {};
            }
        });

        await fetch(`https://api.github.com/gists/${gistId}`, {
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
    } catch (e) {
        console.error("Erro no Cloud Push:", e);
    }
}
