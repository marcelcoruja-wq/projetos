/* cloud.js - Sincronizador Inteligente com Suporte a Deleção */
const CLOUD_TOKEN_KEY = 'cloud_gist_token';
const CLOUD_ID_KEY = 'cloud_gist_id';

const MODULE_KEYS = [
    'persistence_engine_data_v1', // Planejador / Rotina
    'projects_engine_data_v1',    // Gestor de Projetos
    'personalFinanceData',        // Finanças Pessoais
    'pomodoro_engine_data_v1'     // Pomodoro
];

// 1. Puxar dados da nuvem
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

            MODULE_KEYS.forEach(key => {
                if (parsed[key] !== undefined) {
                    localStorage.setItem(key, JSON.stringify(parsed[key]));
                }
            });
            return true;
        }
    } catch (e) {
        console.error("Erro no Cloud Pull:", e);
    }
    return false;
}

// 2. Enviar para a nuvem respeitando deleções locais
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
            const rawLocal = localStorage.getItem(key);
            if (rawLocal !== null) {
                // Se a chave existe no localStorage local, envia o estado exato (mesmo modificado ou apagado)
                payload[key] = JSON.parse(rawLocal);
            } else if (remoteParsed[key] !== undefined) {
                // Se o dispositivo nunca carregou este módulo, preserva o remoto
                payload[key] = remoteParsed[key];
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
