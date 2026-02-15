
// using native fetch

async function run() {
    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Hola, prueba de sistema.',
                history: []
            })
        });

        if (!response.ok) {
            console.error('API Error:', response.status, response.statusText);
            const text = await response.text();
            console.error('Response Body:', text);
            return;
        }

        const data = await response.json();
        console.log('API Response:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

run();
