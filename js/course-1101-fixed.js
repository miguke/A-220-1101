// Course configuration for 220-1101
const courseConfig = {
    id: '1101',
    title: 'CompTIA A+ 220-1101',
    topics: {
        'Hardware': { 
            weight: 0.27, // 27%
            file: '../data/1101/hardware.json',
            description: 'Componentes de hardware, montagem de PC, periféricos e impressão.'
        },
        'Networking': { 
            weight: 0.20, // 20%
            file: '../data/1101/networking.json',
            description: 'Conceitos de rede, protocolos, dispositivos e configurações.'
        },
        'Mobile Devices': { 
            weight: 0.15, // 15%
            file: '../data/1101/mobile-devices.json',
            description: 'Dispositivos móveis, configuração e sincronização.'
        },
        'Virtualization & Cloud': { 
            weight: 0.11, // 11%
            file: '../data/1101/virtualization-cloud.json',
            description: 'Conceitos de virtualização, serviços em nuvem e computação em nuvem.'
        },
        'Hardware & Network Troubleshooting': { 
            weight: 0.27, // 27%
            file: '../data/1101/troubleshooting.json',
            description: 'Resolução de problemas de hardware e rede.'
        }
    },
    examDuration: 5400, // 90 minutes in seconds
    examQuestionCount: 90, // Total questions for a simulated exam
    passingScore: 675, // Passing score out of 900
    maxScore: 900,
    description: 'O exame 220-1101 cobre tecnologias móveis, redes tradicionais, nuvem, virtualização e solução de problemas de uma ampla variedade de dispositivos e sistemas.'
};

// Calculate and set the count for each topic based on the actual number of questions in the JSON files
// This will be populated when the course loads
async function updateTopicCounts() {
    console.log('Updating topic counts...');
    const counts = {};
    
    for (const [topic, config] of Object.entries(courseConfig.topics)) {
        try {
            // Add cache-busting to ensure we get fresh data
            const cacheBuster = `?v=${Date.now()}`;
            const response = await fetch(`${config.file}${cacheBuster}`);
            if (response.ok) {
                const questions = await response.json();
                // Store the actual count of questions
                const count = Array.isArray(questions) ? questions.length : 0;
                config.count = count;
                counts[topic] = count;
                console.log(`Loaded ${count} questions for ${topic}`);
            } else {
                console.error(`Failed to load questions for ${topic}: ${response.statusText}`);
                config.count = 0;
                counts[topic] = 0;
            }
        } catch (error) {
            console.error(`Error loading questions for ${topic}:`, error);
            config.count = 0;
            counts[topic] = 0;
        }
    }
    
    console.log('Updated topic counts:', counts);
    return counts;
}

// Initialize the counts when the module loads
let countsPromise = updateTopicCounts().catch(error => {
    console.error('Error in initial topic count update:', error);
    return {};
});

// Export the course config and the update function
export {
    courseConfig as default,
    updateTopicCounts
};

// For debugging
if (typeof window !== 'undefined') {
    window.__courseConfig = courseConfig;
}
