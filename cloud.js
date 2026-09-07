/* cloud.js - Gerenciador Automático de Nuvem */
const CLOUD_TOKEN_KEY = 'cloud_gist_token';
const CLOUD_ID_KEY = 'cloud_gist_id';

// 1. Puxar dados da nuvem ao carregar a página
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
            let updated = false;

            if (parsed.persistence_engine_data_v1) {
                localStorage.setItem('persistence_engine_data_v1', JSON.stringify(parsed.persistence_engine_data_v1));
                updated = true;
            }
            if (parsed.projects_engine_data_v1) {
                localStorage.setItem('projects_engine_data_v1', JSON.stringify(parsed.projects_engine_data_v1));
                updated = true;
            }
            return updated;
        }
    } catch (e) {
        console.error("Erro no Cloud Pull:", e);
    }
    return false;
}

// 2. Enviar dados para a nuvem sempre que algo for salvo
async function cloudPush() {
    const token = localStorage.getItem(CLOUD_TOKEN_KEY);
    const gistId = localStorage.getItem(CLOUD_ID_KEY);

    if (!token || !gistId) return;

    const payload = {
        persistence_engine_data_v1: JSON.parse(localStorage.getItem('persistence_engine_data_v1')) || {},
        projects_engine_data_v1: JSON.parse(localStorage.getItem('projects_engine_data_v1')) || {}
    };

    try {
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
