/* cloud.js - Sincronização Direta com Anti-Cache HTTP */
const CLOUD_TOKEN_KEY = 'cloud_gist_token';
const CLOUD_ID_KEY = 'cloud_gist_id';

const MODULE_KEYS = [
    'persistence_engine_data_v1', // Planejador / Rotina
    'projects_engine_data_v1',    // Gestor de Projetos
    'personalFinanceData',        // Finanças Pessoais
    'pomodoro_engine_data_v1'     // Pomodoro
];

// 1. Puxar da nuvem garantindo leitura sem cache HTTP
async function cloudPull() {
    const token = localStorage.getItem(CLOUD_TOKEN_KEY);
    const gistId = localStorage.getItem(CLOUD_ID_KEY);

    if (!token || !gistId) return false;

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        if (!res.ok) {
            console.error("❌ Erro HTTP no Cloud Pull:", res.status);
            return false;
        }

        const gistData = await res.json();
        const content = gistData.files['dados.json']?.content;

        if (content && content !== '{}') {
            const parsed = JSON.parse(content);

            MODULE_KEYS.forEach(key => {
                const remoteObj = parsed[key];
                if (remoteObj && typeof remoteObj === 'object' && Object.keys(remoteObj).length > 0) {
                    localStorage.setItem(key, JSON.stringify(remoteObj));
                }
            });
            console.log("✅ Dados puxados da nuvem com sucesso!");
            return true;
        }
    } catch (e) {
        console.error("❌ Erro de rede no Cloud Pull:", e);
    }
    return false;
}

// 2. Enviar dados locais para o arquivo dados.json no GitHub Gist
async function cloudPush() {
    const token = localStorage.getItem(CLOUD_TOKEN_KEY);
    const gistId = localStorage.getItem(CLOUD_ID_KEY);

    if (!token || !gistId) {
        console.warn("⚠️ Token ou Gist ID não configurados.");
        return false;
    }

    const payload = {};
    MODULE_KEYS.forEach(key => {
        const raw = localStorage.getItem(key);
        if (raw) {
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
            console.log("✅ Sincronização com o Gist concluída!");
            return true;
        } else {
            const errText = await res.text();
            console.error("❌ Erro HTTP no Cloud Push:", res.status, errText);
            return false;
        }
    } catch (e) {
        console.error("❌ Erro de rede no Cloud Push:", e);
        return false;
    }
}
