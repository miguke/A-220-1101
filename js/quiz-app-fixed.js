// Wait for the DOM to be fully loaded before initializing the app
document.addEventListener('DOMContentLoaded', () => {
    // Global variables
    let quizQuestions = [];
    let currentQ = 0;
    let correctCount = 0;
    let answered = false;
    let userAnswers = [];
    let selectedTopics = [];
    let examTimer = null;
    let examTimeRemaining = 0;
    let courseConfig = null;
    let topicConfig = {};
    
    // DOM Elements
    let startScreen, quizScreen, topicList, qText, optionsList, resultMsg, explText, explanation;
    let prevBtn, nextBtn, submitBtn, currentQEl, totalQEl, correctAEl, accuracyEl, progressFill;
    let timeRemainingEl, timerDisplay;
    
    // Import the course configuration
    const loadCourseConfig = async () => {
        try {
            console.log('Loading course configuration...');
            const module = await import('./course-1101-fixed.js');
            console.log('Module loaded:', module);
            
            // Use the default export
            courseConfig = module.default;
            
            if (!courseConfig) {
                throw new Error('Course configuration not found in module');
            }
            
            console.log('Course config loaded:', courseConfig);
            
            // Set the exam time remaining based on the course config
            examTimeRemaining = courseConfig.examDuration || 5400; // Default to 90 minutes if not specified
            
            // Initialize topic configuration
            if (courseConfig.topics) {
                Object.entries(courseConfig.topics).forEach(([topic, config]) => {
                    topicConfig[topic] = config.count;
                });
            }
            
            console.log('Course config loaded:', courseConfig);
            return true;
        } catch (error) {
            console.error('Failed to load course configuration:', error);
            const errorContainer = document.createElement('div');
            errorContainer.className = 'error-container';
            errorContainer.innerHTML = `
                <h1>Error Loading Application</h1>
                <p>Failed to load course configuration. Please check the console for details.</p>
                <p><strong>Error:</strong> ${error.message}</p>
                <p><strong>Stack:</strong> ${error.stack || 'No stack trace available'}</p>
            `;
            document.body.prepend(errorContainer);
            return false;
        }
    };
    
    // Initialize DOM elements
    const initializeDOMElements = () => {
        startScreen = document.getElementById('startScreen');
        quizScreen = document.getElementById('quizScreen');
        topicList = document.getElementById('topicList');
        qText = document.getElementById('qText');
        optionsList = document.getElementById('optionsList');
        resultMsg = document.getElementById('resultMsg');
        explText = document.getElementById('explText');
        explanation = document.getElementById('explanation');
        prevBtn = document.getElementById('prevBtn');
        nextBtn = document.getElementById('nextBtn');
        submitBtn = document.getElementById('submitBtn');
        currentQEl = document.getElementById('currentQ');
        totalQEl = document.getElementById('totalQ');
        correctAEl = document.getElementById('correctA');
        accuracyEl = document.getElementById('accuracy');
        progressFill = document.getElementById('progressFill');
        timeRemainingEl = document.getElementById('time-remaining');
        timerDisplay = document.getElementById('timer-display');
    };
    
    // Check if required elements exist
    const checkRequiredElements = () => {
        const requiredElements = {
            startScreen,
            quizScreen,
            topicList,
            qText,
            optionsList,
            resultMsg,
            explText,
            explanation,
            prevBtn,
            nextBtn,
            submitBtn,
            currentQEl,
            totalQEl,
            correctAEl,
            accuracyEl,
            progressFill,
            timeRemainingEl,
            timerDisplay
        };

        // Log any missing elements
        const missingElements = Object.entries(requiredElements)
            .filter(([_, element]) => !element)
            .map(([name]) => name);

        if (missingElements.length > 0) {
            console.error('Missing required elements:', missingElements);
            const errorMsg = `Error: Missing required elements: ${missingElements.join(', ')}. Please check the console for details.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
    };
    
    // Set up event listeners
    const setupEventListeners = () => {
        document.getElementById('startBtn')?.addEventListener('click', startQuiz);
        document.getElementById('selectAllBtn')?.addEventListener('click', selectAllTopics);
        document.getElementById('realExamBtn')?.addEventListener('click', startRealExam);
        document.getElementById('menuBtn')?.addEventListener('click', goToMenu);
        
        if (submitBtn) submitBtn.addEventListener('click', () => submitA(false));
        if (nextBtn) nextBtn.addEventListener('click', nextQ);
        if (prevBtn) prevBtn.addEventListener('click', prevQ);
        
        // Add keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && submitBtn && !submitBtn.disabled) {
                submitA(false);
            } else if (e.key === 'ArrowRight' && nextBtn && !nextBtn.disabled) {
                nextQ();
            } else if (e.key === 'ArrowLeft' && prevBtn && !prevBtn.disabled) {
                prevQ();
            } else if (e.key === 'Escape') {
                goToMenu();
            }
        });
    };
    
    // Initialize the application
    const init = async () => {
        try {
            console.log('Initializing application...');
            
            const configLoaded = await loadCourseConfig();
            if (!configLoaded) {
                console.error('Failed to load course configuration');
                return;
            }
            
            console.log('Initializing topicConfig from courseConfig...');
            console.log('courseConfig.topics:', courseConfig?.topics);
            
            // Initialize topicConfig from courseConfig
            if (courseConfig?.topics) {
                console.log('Processing topics...');
                for (const [topic, config] of Object.entries(courseConfig.topics)) {
                    console.log(`Adding topic: ${topic} with ${config.count} questions`);
                    topicConfig[topic] = config.count;
                }
                console.log('topicConfig after initialization:', topicConfig);
            } else {
                console.error('No topics found in course configuration');
            }
            
            // Initialize DOM elements
            initializeDOMElements();
            
            // Check for required elements
            checkRequiredElements();
            
            // Set up event listeners
            setupEventListeners();
            
            // Render topics
            renderTopics();
            
            // Check for URL parameters to start quiz directly
            const urlParams = new URLSearchParams(window.location.search);
            const topicParam = urlParams.get('topic');
            
            if (topicParam) {
                const topic = topicParam.replace(/-/g, ' ');
                if (topic in topicConfig) {
                    selectedTopics = [topic];
                    const topicCheckbox = document.querySelector(`input[value="${topic}"]`);
                    if (topicCheckbox) topicCheckbox.checked = true;
                    startQuiz();
                }
            }
        } catch (error) {
            console.error('Error initializing application:', error);
            alert('Ocorreu um erro ao inicializar o aplicativo. Por favor, verifique o console para mais detalhes.');
        }
    };
    
    // Render topic checkboxes
    function renderTopics() {
        console.log('Rendering topics...');
        console.log('topicList element:', topicList);
        console.log('topicConfig:', topicConfig);
        
        if (!topicList) {
            console.error('topicList element not found');
            return;
        }
        
        topicList.innerHTML = '';
        
        const entries = Object.entries(topicConfig);
        console.log(`Found ${entries.length} topics to render`);
        
        for (const [topic, count] of entries) {
            console.log(`Rendering topic: ${topic} with ${count} questions`);
            const topicId = topic.toLowerCase().replace(/ /g, '-');
            const topicInfo = courseConfig?.topics?.[topic] || {};
            const div = document.createElement('div');
            div.className = 'topic-item';
            div.innerHTML = `
                <div class="topic-header">
                    <input type="checkbox" id="${topicId}" value="${topic}">
                    <label for="${topicId}">${topic} (${count} questÃµes)</label>
                </div>
                ${topicInfo.description ? `<p class="topic-description">${topicInfo.description}</p>` : ''}
            `;
            const checkbox = div.querySelector('input[type="checkbox"]');
            div.addEventListener('change', (e) => {
                if (e.target === checkbox) {
                    toggleTopic(topic, checkbox.checked);
                }
            });
            topicList.appendChild(div);
        }
    }
    
    // Toggle topic selection
    const toggleTopic = (topic, isChecked) => {
        const index = selectedTopics.indexOf(topic);
        if (isChecked && index === -1) {
            selectedTopics.push(topic);
        } else if (!isChecked && index !== -1) {
            selectedTopics.splice(index, 1);
        }
        console.log('Selected topics:', selectedTopics);
        updateUI();
    };
    
    // Select all topics
    const selectAllTopics = () => {
        selectedTopics = [...Object.keys(topicConfig)];
        const checkboxes = document.querySelectorAll('#topicList input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
                checkbox.checked = true;
                const topic = checkbox.value;
                if (selectedTopics.indexOf(topic) === -1) {
                    selectedTopics.push(topic);
                }
            }
        });
        console.log('Selected topics after select all:', selectedTopics);
        updateUI();
    };
    
    // Update UI
    const updateUI = () => {
        const startBtn = document.getElementById('startBtn');
        const realExamBtn = document.getElementById('realExamBtn');
        
        if (selectedTopics.length > 0) {
            startBtn.disabled = false;
            realExamBtn.disabled = false;
            
            // Update topic checkboxes
            const checkboxes = document.querySelectorAll('#topicList input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = selectedTopics.includes(checkbox.value);
            });
            
            // Update button text
            startBtn.textContent = `Iniciar Quiz (${selectedTopics.length} tÃ³picos)`;
            realExamBtn.textContent = `Simulado Completo (${selectedTopics.length} tÃ³picos)`;
        } else {
            startBtn.disabled = true;
            realExamBtn.disabled = true;
            startBtn.textContent = 'Selecione pelo menos um tÃ³pico';
            realExamBtn.textContent = 'Selecione pelo menos um tÃ³pico';
        }
    };
    
    // Start the exam timer
    const startExamTimer = () => {
        updateTimerDisplay();
        examTimer = setInterval(updateExamTimer, 1000);
    };
    
    // Update the exam timer
    const updateExamTimer = () => {
        if (examTimeRemaining <= 0) {
            stopExamTimer();
            alert('Tempo esgotado! O exame foi encerrado.');
            submitA(true);
            return;
        }
        
        examTimeRemaining--;
        updateTimerDisplay();
    };
    
    // Stop the exam timer
    const stopExamTimer = () => {
        if (examTimer) {
            clearInterval(examTimer);
            examTimer = null;
        }
    };
    
    // Format time in MM:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    
    // Update the timer display
    const updateTimerDisplay = () => {
        if (timerDisplay) {
            timerDisplay.textContent = formatTime(examTimeRemaining);
        }
    };

    // Function to show a specific screen and hide others
    const showScreen = (screenId) => {
        // Hide all screens
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show the requested screen
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
        }
        
        // If showing quiz screen, ensure it's scrolled to the top
        if (screenId === 'quizScreen') {
            window.scrollTo(0, 0);
        }
    };

    // Start the quiz with selected topics
    const startQuiz = async () => {
        if (selectedTopics.length === 0) {
            alert('Por favor, selecione pelo menos um tópico para o questionário.');
            return;
        }

        // Reset state
        quizQuestions = [];
        currentQ = 0;
        correctCount = 0;
        answered = false;
        userAnswers = [];

        // Show quiz screen
        showScreen('quizScreen');

        // Show loading indicator
        const loadingElement = document.getElementById('loading');
        if (loadingElement) loadingElement.classList.add('active');

        try {
            // Load questions for each selected topic
            for (const topic of selectedTopics) {
                // Map the topic name to the actual filename in the data directory
                const topicToFilename = {
                    'Mobile Devices': 'mobile-devices',
                    'Networking': 'networking',
                    'Hardware': 'hardware',
                    'Virtualization & Cloud': 'virtualization-cloud',
                    'Hardware & Network Troubleshooting': 'troubleshooting'
                };
                
                const filename = topicToFilename[topic] || topic.toLowerCase().replace(/ /g, '-');
                console.log(`Loading questions for topic: ${topic} from file: ${filename}.json`);
                const response = await fetch(`../data/1101/${filename}.json`);

                if (!response.ok) {
                    throw new Error(`Falha ao carregar as perguntas para ${topic}`);
                }


                const questions = await response.json();
                quizQuestions = [...quizQuestions, ...questions];
            }

            // Shuffle questions
            quizQuestions = quizQuestions.sort(() => Math.random() - 0.5);

            // Initialize user answers array
            userAnswers = new Array(quizQuestions.length).fill(null);

            // Hide start screen, show quiz screen
            if (startScreen) startScreen.classList.remove('active');
            if (quizScreen) quizScreen.classList.add('active');

            const resultScreenElement = document.getElementById('resultScreen');
            if (resultScreenElement) {
                resultScreenElement.classList.remove('active');
            }

            // Start the timer
            startExamTimer();

            // Show first question
            loadQ();
        } catch (error) {
            console.error('Error loading questions:', error);
            alert('Erro ao carregar as perguntas. Por favor, tente novamente.');
        } finally {
            if (loadingElement) loadingElement.style.display = 'none';
        }
    };

    // Start the real exam simulation
    const startRealExam = async () => {
        console.log('Starting real exam with predefined topic distribution');
        
        // Reset state
        quizQuestions = [];
        currentQ = 0;
        correctCount = 0;
        answered = false;
        userAnswers = [];
        examTimeRemaining = courseConfig.examDuration || 5400; // 90 minutes in seconds

        // Show quiz screen
        showScreen('quizScreen');
        
        // Show loading indicator
        const loadingElement = document.getElementById('loading');
        if (loadingElement) loadingElement.classList.add('active');

        try {
            // Define the number of questions per topic based on the exam objectives
            // Note: Using the exact filenames as they exist in the data directory
            const questionsPerTopic = {
                'mobile-devices': 15,        // ~17% of 90 questions
                'networking': 20,             // ~22% of 90 questions
                'hardware': 25,               // ~28% of 90 questions
                'virtualization-cloud': 11,    // ~12% of 90 questions
                'troubleshooting': 19         // ~21% of 90 questions
            };

            // Load questions from all topics
            for (const [topic, count] of Object.entries(questionsPerTopic)) {
                try {
                    // Use the topic directly as the filename since we're using the exact names
                    const filename = topic;
                    console.log(`Loading questions for ${filename} (${count} questions)`);
                    
                    const response = await fetch(`../data/1101/${filename}.json`);
                    
                    if (!response.ok) {
                        console.error(`Failed to load questions for ${topic}:`, response.statusText);
                        continue; // Skip this topic if there's an error loading the file
                    }

                    const questions = await response.json();
                    
                    if (!Array.isArray(questions) || questions.length === 0) {
                        console.warn(`No questions found for topic: ${topic}`);
                        continue;
                    }
                    
                    // Shuffle and select the required number of questions
                    const shuffled = [...questions].sort(() => 0.5 - Math.random());
                    const selected = shuffled.slice(0, Math.min(count, questions.length));
                    
                    console.log(`Selected ${selected.length} questions for ${topic}`);
                    quizQuestions = [...quizQuestions, ...selected];
                } catch (error) {
                    console.error(`Error loading questions for ${topic}:`, error);
                }
            }

            // Shuffle all selected questions
            quizQuestions = quizQuestions.sort(() => 0.5 - Math.random());
            
            // Ensure we have exactly 90 questions
            if (quizQuestions.length > 90) {
                quizQuestions = quizQuestions.slice(0, 90);
            } else if (quizQuestions.length < 90) {
                console.warn(`Only ${quizQuestions.length} questions were loaded, expected 90`);
            }


            // Initialize user answers array
            userAnswers = new Array(quizQuestions.length).fill(null);

            // Hide start screen, show quiz screen
            if (startScreen) startScreen.classList.remove('active');
            if (quizScreen) quizScreen.classList.add('active');

            const resultScreenElement = document.getElementById('resultScreen');
            if (resultScreenElement) {
                resultScreenElement.classList.remove('active');
            }

            // Start the timer
            startExamTimer();
            // Show first question
            loadQ();
        } catch (error) {
            console.error('Error loading questions:', error);
            alert('Erro ao carregar as perguntas. Por favor, tente novamente.');
        } finally {
            if (loadingElement) loadingElement.style.display = 'none';
        }
    };

    // Go back to menu
    const goToMenu = () => {
        if (confirm('Tem a certeza que deseja voltar ao menu? O progresso atual será perdido.')) {
            // Stop timer if running
            stopExamTimer();
            
            // Reset state
            currentQ = 0;
            correctCount = 0;
            answered = false;
            userAnswers = [];
            quizQuestions = [];
            
            // Show start screen
            showScreen('startScreen');
            
            // Reset timer display
            if (courseConfig) {
                examTimeRemaining = courseConfig.examDuration || 5400; // Default to 90 minutes
            }
            updateTimerDisplay();
            if (timeRemainingEl) timeRemainingEl.style.display = 'none';
            
            // Reset topic checkboxes
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            selectedTopics = [];
        }
    };

    // Load the current question
    const loadQ = () => {
        if (quizQuestions.length === 0) return;
        
        const q = quizQuestions[currentQ];
        
        // Update question text
        if (qText) qText.textContent = q.question;
        
        // Clear previous options
        if (optionsList) optionsList.innerHTML = '';
        
        // Add new options
        if (q.options && optionsList) {
            q.options.forEach((option, index) => {
                const li = document.createElement('li');
                li.className = 'option';
                
                const input = document.createElement('input');
                input.type = q.correct && q.correct.length > 1 ? 'checkbox' : 'radio';
                input.name = 'answer';
                input.value = index;
                input.id = `option-${index}`;
                input.disabled = answered;
                
                const label = document.createElement('label');
                label.htmlFor = `option-${index}`;
                label.textContent = option;
                
                li.appendChild(input);
                li.appendChild(label);
                optionsList.appendChild(li);
            });
        }
        
        // Update UI state
        if (currentQEl) currentQEl.textContent = currentQ + 1;
        if (prevBtn) prevBtn.disabled = currentQ === 0;
        if (nextBtn) nextBtn.style.display = 'none';
        if (submitBtn) {
            submitBtn.style.display = 'inline-flex';
            submitBtn.disabled = false;
        }
        
        // Reset explanation and result message
        if (explanation) explanation.classList.remove('show');
        if (resultMsg) resultMsg.classList.remove('show');
        
        // Restore previous answer if exists
        if (userAnswers[currentQ]) {
            const { selected } = userAnswers[currentQ];
            if (selected) {
                selected.forEach(optionIndex => {
                    const input = document.querySelector(`input[value="${optionIndex}"]`);
                    if (input) input.checked = true;
                });
                
                if (answered) {
                    showFeedback(q, selected);
                }
            }
        }
    };

    // Submit answer
    const submitA = (isAutoSubmit = false) => {
        if (!isAutoSubmit) {
            const selected = Array.from(document.querySelectorAll('input:checked')).map(input => parseInt(input.value));
            
            if (selected.length === 0) {
                alert('Selecione pelo menos uma resposta.');
                return;
            }
            
            const q = quizQuestions[currentQ];
            const isCorrect = arraysEqual(selected.sort(), [...q.correct].sort());
            
            // Save user answer
            userAnswers[currentQ] = { selected, correct: q.correct, isCorrect };
            
            // Update score if not previously answered
            if (isCorrect && !userAnswers[currentQ].isCorrect) {
                correctCount++;
            } else if (!isCorrect && userAnswers[currentQ].isCorrect) {
                correctCount--;
            }
            
            // Show feedback
            showFeedback(q, selected);
            
            // Disable inputs
            document.querySelectorAll('input').forEach(input => {
                input.disabled = true;
            });
            
            // Update UI
            if (submitBtn) submitBtn.style.display = 'none';
            if (nextBtn) {
                nextBtn.style.display = 'inline-flex';
                nextBtn.focus();
            }
            
            // Only stop timer on manual submit if not in exam mode
            if (!isAutoSubmit && timeRemainingEl && timeRemainingEl.style.display !== 'flex') {
                stopExamTimer();
            }
        }
        
        // Auto-submit at the end of the exam
        if (isAutoSubmit) {
            // Mark all unanswered questions as incorrect
            for (let i = 0; i < quizQuestions.length; i++) {
                if (userAnswers[i] === null || userAnswers[i] === undefined) {
                    const q = quizQuestions[i];
                    userAnswers[i] = { selected: [], correct: q.correct, isCorrect: false };
                }
            }
            
            // Show final score
            const score = Math.round((correctCount / quizQuestions.length) * 900); // Scale to 900
            const passed = courseConfig && score >= courseConfig.passingScore;
            
            alert(`Exame concluÃ­do!\n\n` +
                  `PontuaÃ§Ã£o: ${score}/${courseConfig?.maxScore || 900}\n` +
                  `Respostas corretas: ${correctCount}/${quizQuestions.length}\n` +
                  `Status: ${passed ? 'Aprovado!' : 'Reprovado'}`);
            
            // Go to menu after a delay
            setTimeout(goToMenu, 1000);
        }
    };

    // Show feedback for the answer
    const showFeedback = (q, selected) => {
        if (!q || !selected) return;
        
        const isCorrect = arraysEqual(selected.sort(), [...q.correct].sort());
        
        // Update result message
        if (resultMsg) {
            resultMsg.textContent = isCorrect ? 'âœ… Correto!' : 'âŒ Incorreto';
            resultMsg.className = `result-message ${isCorrect ? 'result-correct' : 'result-incorrect'} show`;
        }
        
        // Show explanation
        if (q.explanation && explText && explanation) {
            explText.textContent = q.explanation;
            explanation.classList.add('show');
        }
        
        // Update stats
        updateStats();
        
        // Mark correct/incorrect answers
        const options = document.querySelectorAll('.option');
        options.forEach((option, index) => {
            if (q.correct.includes(index)) {
                option.classList.add('correct');
            } else if (selected.includes(index)) {
                option.classList.add('incorrect');
            }
        });
    };

    // Go to next question
    const nextQ = () => {
        if (currentQ < quizQuestions.length - 1) {
            currentQ++;
            loadQ();
        } else {
            // End of quiz
            submitA(true);
        }
    };

    // Go to previous question
    const prevQ = () => {
        if (currentQ > 0) {
            currentQ--;
            loadQ();
        }
    };

    // Update stats
    const updateStats = () => {
        if (!userAnswers || !correctAEl || !accuracyEl || !progressFill) return;
        
        const totalAnswered = userAnswers.filter(a => a !== null && a !== undefined).length;
        const correct = userAnswers.filter(a => a && a.isCorrect).length;
        
        correctAEl.textContent = correct;
        accuracyEl.textContent = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;
        
        // Update progress bar
        const progress = (currentQ / (quizQuestions.length || 1)) * 100;
        progressFill.style.width = `${progress}%`;
    };

    // Utility function to shuffle an array
    const shuffle = (array) => {
        if (!array || !Array.isArray(array)) return [];
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    };

    // Utility function to compare arrays
    const arraysEqual = (a, b) => {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        
        // Sort arrays before comparing
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        
        for (let i = 0; i < sortedA.length; i++) {
            if (sortedA[i] !== sortedB[i]) return false;
        }
        return true;
    };
    
    // Start the application
    init();
});
