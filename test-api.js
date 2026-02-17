// Using global fetch (Node 18+)

async function testApi() {
    const apiKey = '7eZ4cZ40Z7dZ3aZ3fZ74Z5aZ3dZ4eZ80Z75Z60Z6dZ69Z6c';
    const url = 'https://api.linkfinderai.com';

    const body = {
        type: 'lead_full_name_to_linkedin_url',
        input_data: 'Bill Gates Microsoft'
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testApi();
