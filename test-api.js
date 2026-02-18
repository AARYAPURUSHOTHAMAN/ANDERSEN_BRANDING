// Using global fetch (Node 18+)

async function testApi() {
    const apiKey = '55Z7dZ51Z7fZ68Z5fZ78Z80Z5cZ6fZ50Z49Z80Z73Z7dZ60';
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
