/* cloud.js - Sincronização Definitiva Sem Bloqueio CORS (v11) */
const CLOUD_TOKEN_KEY = 'cloud_gist_token';
const CLOUD_ID_KEY = 'cloud_gist_id';
const SYNC_LOCK_KEY = 'cloud_sync_last_push';

const MODULE_KEYS = [
    'persistence_engine_data_v1',
    'projects_engine_data_v1',
    'personalFinanceData',
    'pomodoro_engine_data_v1'
];

async function cloudPull() {
    const token = (localStorage.getItem(CLOUD_TOKEN_KEY) || '').trim();
    const gistId = (localStorage.getItem(CLOUD_ID_KEY) || '').trim();
    if (!token || !gistId) return false;

    const lastPush = parseInt(localStorage.getItem(SYNC_LOCK_KEY) || '0');
    if (Date.now() - lastPush < 30000) return false;

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!res.ok) return false;

        const gistData = await res.json();
        const content = gistData.files['dados.json']?.content;

        if (content && content !== '{}') {
            const parsed = JSON.parse(content);
            MODULE_KEYS.forEach(key => {
                if (parsed[key] && Object.keys(parsed[key]).length > 0) {
                    localStorage.setItem(key, JSON.stringify(parsed[key]));
                }
            });
            return true;
        }
    } catch (e) {
        console.error("Erro no cloudPull:", e);
    }
    return false;
}

async function cloudPush() {
    const token = (localStorage.getItem(CLOUD_TOKEN_KEY) || '').trim();
    const gistId = (localStorage.getItem(CLOUD_ID_KEY) || '').trim();
    
    if (!token || !gistId) {
        alert("⚠️ Erro Interno: O cloud.js não conseguiu ler o Token da memória!");
        return false;
    }

    try {
        let remotePayload = {};
        // 1. Puxa os dados antigos para não apagar o que já está lá
        const getRes = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (getRes.ok) {
            const gistData = await getRes.json();
            const content = gistData.files['dados.json']?.content;
            if (content) {
                try { remotePayload = JSON.parse(content); } catch(e) {}
            }
        } else {
            alert(`⚠️ Falha ao ler Gist antes de salvar (Código: ${getRes.status})`);
            return false;
        }

        // 2. Mescla com os dados locais
        MODULE_KEYS.forEach(key => {
            const raw = localStorage.getItem(key);
            if (raw) {
                try {
                    const parsedLocal = JSON.parse(raw);
                    if (parsedLocal && Object.keys(parsedLocal).length > 0) {
                        remotePayload[key] = parsedLocal;
                    }
                } catch(e) {}
            }
        });

        // 3. Envia para o GitHub sem cabeçalhos restritivos de CORS
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                files: { 'dados.json': { content: JSON.stringify(remotePayload, null, 2) } }
            })
        });

        if (res.ok) {
            localStorage.setItem(SYNC_LOCK_KEY, Date.now().toString());
            return true;
        } else {
            const errText = await res.text();
            alert(`🚨 O GitHub rejeitou o formato dos dados: ${res.status}\n${errText}`);
            return false;
        }
    } catch (e) {
        alert("🚨 Ocorreu um erro de rede: " + e.message);
        return false;
    }
}
