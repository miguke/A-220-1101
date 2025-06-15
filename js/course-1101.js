// Course configuration for 220-1101
const courseConfig = {
    id: '1101',
    title: 'CompTIA A+ 220-1101',
    topics: {
        'Hardware': { 
            count: 27, 
            file: '../data/1101/hardware.json',
            description: 'Componentes de hardware, montagem de PC, periféricos e impressão.'
        },
        'Networking': { 
            count: 20, 
            file: '../data/1101/networking.json',
            description: 'Conceitos de rede, protocolos, dispositivos e configurações.'
        },
        'Mobile Devices': { 
            count: 14, 
            file: '../data/1101/mobile.json',
            description: 'Dispositivos móveis, configuração e sincronização.'
        },
        'Virtualization & Cloud': { 
            count: 12, 
            file: '../data/1101/virtualization-cloud.json',
            description: 'Conceitos de virtualização, serviços em nuvem e computação em nuvem.'
        },
        'Hardware & Network Troubleshooting': { 
            count: 27, 
            file: '../data/1101/troubleshooting.json',
            description: 'Resolução de problemas de hardware e rede.'
        }
    },
    examDuration: 5400, // 90 minutes in seconds
    passingScore: 675, // Passing score out of 900
    maxScore: 900,
    description: 'O exame 220-1101 cobre tecnologias móveis, redes tradicionais, nuvem, virtualização e solução de problemas de uma ampla variedade de dispositivos e sistemas.'
};

export default courseConfig;
