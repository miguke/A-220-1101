# CompTIA A+ 220-1101 Study App

Um aplicativo de estudo interativo para o exame CompTIA A+ 220-1101 que permite aos usuários praticar com perguntas baseadas nos objetivos do exame.

## Recursos

- **Modo de Estudo**: Pratique por tópicos específicos
- **Simulado de Exame**: Simule um exame real com 90 perguntas em 90 minutos
- **Feedback Imediato**: Veja explicações detalhadas para cada resposta
- **Acompanhamento de Progresso**: Acompanhe seu desempenho com estatísticas em tempo real
- **Interface Responsiva**: Funciona em desktops, tablets e smartphones

## Estrutura do Projeto

```
A-220-1101/
├── 1101/                  # Páginas específicas do curso 220-1101
│   └── quiz.html         # Página principal do quiz
├── css/                   # Folhas de estilo
│   ├── quiz.css          # Estilos específicos do quiz
│   └── styles.css        # Estilos gerais
├── data/                  # Dados do aplicativo
│   └── 1101/             # Dados específicos do curso 220-1101
│       ├── hardware.json  # Perguntas sobre hardware
│       ├── mobile.json    # Perguntas sobre dispositivos móveis
│       ├── networking.json # Perguntas sobre redes
│       ├── troubleshooting.json # Perguntas sobre solução de problemas
│       └── virtualization-cloud.json # Perguntas sobre virtualização e nuvem
├── js/                    # Código JavaScript
│   ├── app.js            # Lógica principal do aplicativo
│   ├── course-1101.js    # Configuração do curso 220-1101
│   └── quiz-app.js       # Lógica do quiz
├── assets/                # Recursos estáticos (imagens, etc.)
├── index.html            # Página de seleção de curso
└── server.py             # Servidor Python para desenvolvimento local
```

## Como Executar Localmente

1. **Pré-requisitos**:
   - Python 3.6 ou superior
   - Navegador moderno (Chrome, Firefox, Edge, Safari)

2. **Instalação**:
   ```bash
   # Clone o repositório
   git clone [URL_DO_REPOSITÓRIO]
   cd A-220-1101
   ```

3. **Iniciar o servidor de desenvolvimento**:
   ```bash
   python server.py
   ```
   Isso iniciará um servidor local em `http://localhost:8000` e abrirá automaticamente o navegador.

4. **Acessar o aplicativo**:
   - Abra seu navegador e acesse `http://localhost:8000`
   - Selecione o curso "CompTIA A+ 220-1101"
   - Escolha entre o modo de estudo ou simulado de exame

## Personalização

### Adicionar Novas Perguntas

1. Edite os arquivos JSON na pasta `data/1101/` para adicionar ou modificar perguntas.
2. O formato de cada pergunta deve ser:
   ```json
   {
     "id": 1,
     "type": "single",
     "question": "Sua pergunta aqui",
     "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
     "correct": [0],
     "explanation": "Explicação detalhada da resposta correta"
   }
   ```
   - `type`: Pode ser "single" (uma resposta) ou "multiple" (múltiplas respostas)
   - `correct`: Índice(ices) da(s) opção(ões) correta(s) no array `options`

### Personalizar o Tema

Edite os arquivos CSS em `css/` para personalizar as cores, fontes e layout do aplicativo.

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## Agradecimentos

- CompTIA pelos objetivos do exame A+ 220-1101
- Comunidade de TI por compartilhar conhecimento e recursos
- Contribuidores de código aberto por suas bibliotecas e ferramentas
