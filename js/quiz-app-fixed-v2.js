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
    let prevBtn, nextBtn, submitBtn, menuBtn, currentQEl, totalQEl, correctAEl, accuracyEl, progressFill;
    let timeRemainingEl, timerDisplay;
    
    // Import the course configuration
    const loadCourseConfig = async () => {
        try {
            console.log('Loading course configuration...');
            // Add cache-busting to ensure we get the latest version
            const cacheBuster = `?v=${Date.now()}`;
            const module = await import(`./course-1101-fixed.js${cacheBuster}`);
            console.log('Module loaded:', module);
            
            // Use the default export
            courseConfig = module.default;
            
            if (!courseConfig) {
                throw new Error('Course configuration not found in module');
            }
            
            console.log('Course config loaded:', courseConfig);
            
            // Wait for topic counts to be updated
            console.log('Updating topic counts...');
            const { updateTopicCounts } = module;
            if (typeof updateTopicCounts === 'function') {
                await updateTopicCounts();
            } else {
                console.warn('updateTopicCounts function not found in module');
            }
            
            // Initialize topic configuration with the updated counts
            topicConfig = {};
            for (const [topic, cfg] of Object.entries(courseConfig.topics)) {
                // Use the count from the config if available, otherwise default to 0
                topicConfig[topic] = cfg.count || 0;
                console.log(`Topic ${topic} has ${topicConfig[topic]} questions`);
            }
            
            // Set the exam time remaining based on the course config
            examTimeRemaining = courseConfig.examDuration || 5400; // Default to 90 minutes if not specified
            
            // After loading the config and updating counts, re-render the topic list
            if (typeof renderTopics === 'function') {
                console.log('Re-rendering topic list with updated counts');
                renderTopics();
            } else {
                console.warn('renderTopics function not available yet');
            }
            
            return true;
        } catch (error) {
            console.error('Failed to load course configuration:', error);
            const errorContainer = document.createElement('div');
            errorContainer.className = 'error-container';
            errorContainer.innerHTML = `
                <h1>Error Loading Application</h1>
                <p>Failed to load course configuration. Please check the console for details.</p>
                <p><strong>Error:</strong> ${error.message}</p>
            `;
            document.body.prepend(errorContainer);
            return false;
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
        selectedTopics = [];
        const checkboxes = document.querySelectorAll('#topicList input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            const topic = checkbox.value;
            if (!selectedTopics.includes(topic)) {
                selectedTopics.push(topic);
            }
        });
        console.log('Selected topics after select all:', selectedTopics);
        updateUI();
    };
    
    // Render topic checkboxes
    const renderTopics = () => {
        const topicList = document.getElementById('topicList');
        if (!topicList) {
            console.error('topicList element not found');
            return;
        }
        
        console.log('Rendering topics with config:', {
            topicConfig,
            courseConfigTopics: courseConfig?.topics,
            selectedTopics
        });
        
        topicList.innerHTML = '';
        
        // Get topics from courseConfig to ensure we have the latest counts
        const entries = Object.entries(courseConfig?.topics || {});
        
        if (entries.length === 0) {
            console.error('No topics found in courseConfig');
            topicList.innerHTML = '<p>Nenhum tópico disponível. Por favor, recarregue a página.</p>';
            return;
        }
        
        for (const [topic, config] of entries) {
            const count = config.count || 0;
            console.log(`Processing topic: ${topic}, count: ${count}`);
            
            const topicId = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const isSelected = selectedTopics.includes(topic);
            
            const div = document.createElement('div');
            div.className = 'topic-item' + (isSelected ? ' selected' : '');
            
            div.innerHTML = `
                <div class="topic-header">
                    <input type="checkbox" id="${topicId}" value="${topic}" ${isSelected ? 'checked' : ''}>
                    <label for="${topicId}">${topic} (${count} ${count === 1 ? 'questão' : 'questões'})</label>
                </div>
                ${config.description ? `<p class="topic-description">${config.description}</p>` : ''}
            `;
            
            const checkbox = div.querySelector('input[type="checkbox"]');
            
            // Handle checkbox changes
            checkbox.addEventListener('change', (e) => {
                div.classList.toggle('selected', checkbox.checked);
                toggleTopic(topic, checkbox.checked);
            });
            
            // Make the entire topic item clickable
            div.addEventListener('click', (e) => {
                if (e.target !== checkbox && e.target.tagName !== 'LABEL') {
                    checkbox.checked = !checkbox.checked;
                    div.classList.toggle('selected', checkbox.checked);
                    toggleTopic(topic, checkbox.checked);
                }
            });
            
            topicList.appendChild(div);
        }
    };
    
    // Update UI
    const updateUI = () => {
        const startBtn = document.getElementById('startBtn');
        const realExamBtn = document.getElementById('realExamBtn');
        
        if (selectedTopics.length > 0) {
            startBtn.disabled = false;
            realExamBtn.disabled = false;
            startBtn.textContent = `Iniciar Quiz (${selectedTopics.length} tópicos)`;
            realExamBtn.textContent = `Simulado Completo (${selectedTopics.length} tópicos)`;
        } else {
            startBtn.disabled = true;
            realExamBtn.disabled = true;
            startBtn.textContent = 'Selecione pelo menos um tópico';
            realExamBtn.textContent = 'Selecione pelo menos um tópico';
        }
    };
    
    // Helper to map topic names to JSON filenames
    const topicFilenameMap = {
        'Mobile Devices': 'mobile-devices',
        'Networking': 'networking',
        'Hardware': 'hardware',
        'Virtualization & Cloud': 'virtualization-cloud',
        'Hardware & Network Troubleshooting': 'troubleshooting'
    };

    const getTopicFilename = (topic) => {
        if (topicFilenameMap[topic]) return topicFilenameMap[topic];
        return topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    };

    // Utility function to shuffle an array
    const shuffle = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    // Utility function to format seconds as MM:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Compare two arrays for equality (assumes they are already sorted)
    const arraysEqual = (a, b) => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    };

    // Update the timer display element
    const updateTimerDisplay = () => {
        if (timerDisplay) {
            timerDisplay.textContent = formatTime(examTimeRemaining);
        }
    };

    // Tick function for exam timer
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

    let examTimerInterval = null;

    // Start the exam timer
    const startExamTimer = () => {
        stopExamTimer();
        updateTimerDisplay();

let examTimerInterval = null;

// Start the exam timer
const startExamTimer = () => {
    stopExamTimer();
    updateTimerDisplay();
    examTimerInterval = setInterval(updateExamTimer, 1000);
};

// Stop the exam timer
const stopExamTimer = () => {
    if (examTimerInterval) {
        clearInterval(examTimerInterval);
        examTimerInterval = null;
    }
};

// Load questions for selected topics
const loadQuestions = async () => {
    try {
        quizQuestions = [];
        
        // Ensure we have the latest course config and topic counts
        if (!courseConfig || !courseConfig.topics) {
            console.warn('Course config not loaded, reloading...');
            await loadCourseConfig();
        }
        
        // If no topics selected, use all topics
        const topicsToLoad = selectedTopics.length > 0 ? selectedTopics : Object.keys(courseConfig.topics || {});
        console.log('Topics to load:', topicsToLoad);
        
        if (topicsToLoad.length === 0) {
            console.error('No topics to load');
            return false;
        }
        
        // Load questions from all selected topics
        for (const topic of topicsToLoad) {
            const topicConfig = courseConfig.topics[topic];
            if (!topicConfig || !topicConfig.file) {
                console.error(`No file path found for topic: ${topic}`);
                continue;
            }
            
            console.log(`Loading questions for ${topic} from ${topicConfig.file}...`);
            
            try {
                // Add cache-busting to ensure we get fresh data
                const cacheBuster = `?v=${Date.now()}`;
                const response = await fetch(`${topicConfig.file}${cacheBuster}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const topicQuestions = await response.json();
                console.log(`Loaded ${topicQuestions.length} questions from ${topic}`);
                
                // Process and validate questions
                const validQuestions = topicQuestions.filter((q, index) => {
                    const missingFields = [];
                    
                    // Check for required fields
                    if (!q.question || q.question.trim() === '') {
                        missingFields.push('question');
                    }
                    
                    if (!q.options || !Array.isArray(q.options) || q.options.length === 0) {
                        missingFields.push('options');
                    } else {
                        // Validate each option
                        q.options.forEach((opt, i) => {
                            if (typeof opt !== 'string' || opt.trim() === '') {
                                console.warn(`Invalid option at index ${i} in question ${index}:`, opt);
                            }
                        });
                    }
                    
                    if (!q.correct || !Array.isArray(q.correct) || q.correct.length === 0) {
                        missingFields.push('correct');
                    } else if (q.options) {
                        // Validate correct answer indices
                        q.correct.forEach((ans, i) => {
                            if (typeof ans !== 'number' || ans < 0 || ans >= q.options.length) {
                                console.warn(`Invalid correct answer at index ${i} in question ${index}:`, ans);
                                missingFields.push('correct[' + i + ']');
                            }
                        });
                    }
                    
                    if (missingFields.length > 0) {
                        console.warn(`Invalid question at index ${index} (ID: ${q.id || 'N/A'}). Missing fields:`, missingFields);
                        return false;
                    }
                    
                    return true;
                });
                
                // Add topic to each question
                const questionsWithTopic = validQuestions.map(q => ({
                    ...q,
                    topic: topic
                }));
                
                quizQuestions.push(...questionsWithTopic);
                console.log(`Added ${questionsWithTopic.length} valid questions from ${topic}`);
                
            } catch (error) {
                console.error(`Error loading questions for ${topic}:`, error);
                continue; // Skip to next topic on error
            }
        }
        
        console.log(`Total questions loaded: ${quizQuestions.length}`);
        
        if (quizQuestions.length === 0) {
            throw new Error('No valid questions were loaded. Please check the data files.');
        }
        
        // Shuffle the questions
        quizQuestions = shuffle(quizQuestions);
        userAnswers = new Array(quizQuestions.length).fill(null);
        
        console.log(`Final question count: ${quizQuestions.length}`);
        return true;
        
    } catch (error) {
        console.error('Error in loadQuestions:', error);
        return false;
    }
    
    // Load the current question
    const loadQ = () => {
        if (quizQuestions.length === 0 || currentQ >= quizQuestions.length) {
            showResults();
            return;
        }
        
        const q = quizQuestions[currentQ];
        qText.textContent = q.question;
        
        // Clear previous options
        optionsList.innerHTML = '';
        
        // Create options
        q.options.forEach((option, index) => {
            const li = document.createElement('li');
            const input = document.createElement('input');
            input.type = q.correct.length > 1 ? 'checkbox' : 'radio';
            input.name = 'answer';
            input.value = index;
            input.id = `option-${index}`;
            
            // Restore selected state if it exists
            if (userAnswers[currentQ] && userAnswers[currentQ].includes(index)) {
                input.checked = true;
            }
            
            const label = document.createElement('label');
            label.htmlFor = `option-${index}`;
            label.textContent = option;
            
            li.appendChild(input);
            li.appendChild(label);
            optionsList.appendChild(li);
        });
        
        // Update question counter
        currentQEl.textContent = currentQ + 1;
        totalQEl.textContent = quizQuestions.length;
        
        // Update progress bar
        const progress = ((currentQ) / quizQuestions.length) * 100;
        progressFill.style.width = `${progress}%`;
        
        // Update navigation buttons
        prevBtn.disabled = currentQ === 0;
        nextBtn.style.display = 'none'; // hidden until submit
        submitBtn.style.display = 'inline-flex';
        
        // Reset answer state
        answered = false;
        resultMsg.textContent = '';
        explanation.textContent = '';
        explanation.style.display = 'none';
    };
    
    // Submit answer
    const submitA = (isAutoSubmit = false) => {
        if (quizQuestions.length === 0) return;
        
        const q = quizQuestions[currentQ];
        const selected = [];
        const checkboxes = optionsList.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked');
        
        checkboxes.forEach(checkbox => {
            selected.push(parseInt(checkbox.value));
        });
        
        if (selected.length === 0 && !isAutoSubmit) {
            alert('Por favor, selecione uma resposta.');
            return;
        }
        
        answered = true;
        userAnswers[currentQ] = selected;
        
        // Check if answer is correct
        const correctAnswers = Array.isArray(q.correct) 
            ? q.correct.map(Number).sort((a, b) => a - b)
            : [Number(q.correct)];
            
        const selectedAnswers = [...selected].map(Number).sort((a, b) => a - b);
        const isCorrect = arraysEqual(selectedAnswers, correctAnswers);
        
        if (isCorrect) correctCount++;
        
        // Show feedback
        showFeedback(q, selected, isCorrect);
        
        // Disable all inputs
        const inputs = optionsList.querySelectorAll('input');
        inputs.forEach(input => input.disabled = true);
        
        // Show next/submit button
        if (currentQ === quizQuestions.length - 1) {
            submitBtn.textContent = 'Ver Resultados';
            submitBtn.style.display = 'inline-flex';
        } else {
            nextBtn.style.display = 'inline-flex';
        }
        
        // Refresh stats display
        refreshStats();
    };
    
    // Refresh stats display (correct count and accuracy)
    const refreshStats = () => {
        if (!correctAEl || !accuracyEl) return;
        correctAEl.textContent = correctCount;
        const answeredSoFar = userAnswers.filter(a => a !== null).length;
        const accuracy = answeredSoFar > 0 ? Math.round((correctCount / answeredSoFar) * 100) : 0;
        accuracyEl.textContent = accuracy;
    };

    // Show feedback for the answer
    const showFeedback = (q, selected, isCorrect) => {
        resultMsg.textContent = isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta!';
        resultMsg.className = isCorrect ? 'correct' : 'incorrect';
        
        // Show explanation if available
        if (q.explanation) {
            explanation.textContent = q.explanation;
            explanation.style.display = 'block';
        }
        
        // Highlight correct answers
        const correctAnswers = Array.isArray(q.correct) ? q.correct : [q.correct];
        correctAnswers.forEach(index => {
            const input = document.querySelector(`#option-${index}`);
            if (input) {
                const label = input.nextElementSibling;
                label.classList.add('correct-answer');
            }
        });
        
        // Highlight incorrect answers
        selected.forEach(index => {
            if (!correctAnswers.includes(index)) {
                const input = document.querySelector(`#option-${index}`);
                if (input) {
                    const label = input.nextElementSibling;
                    label.classList.add('incorrect-answer');
                }
            }
        });
    };
    
    // Go to next question
    const nextQ = () => {
        if (currentQ < quizQuestions.length - 1) {
            currentQ++;
            loadQ();
        }
    };
    
    // Go to previous question
    const prevQ = () => {
        if (currentQ > 0) {
            currentQ--;
            loadQ();
        }
    };
    
    // Show results
    const showResults = () => {
        const score = Math.round((correctCount / quizQuestions.length) * 100);
        const resultScreen = document.getElementById('resultScreen');
        const scoreElement = document.getElementById('score');
        const totalQuestions = document.getElementById('totalQuestions');
        const correctAnswers = document.getElementById('correctAnswers');
        const percentage = document.getElementById('percentage');
        const reviewBtn = document.getElementById('reviewBtn');
        const restartBtn = document.getElementById('restartBtn');
        
        scoreElement.textContent = score;
        totalQuestions.textContent = quizQuestions.length;
        correctAnswers.textContent = correctCount;
        percentage.textContent = score;
        
        // Set pass/fail class
        scoreElement.className = score >= 70 ? 'pass' : 'fail';
        
        // Show result screen
        showScreen('resultScreen');
        
        // Set up review button
        reviewBtn.onclick = () => {
            currentQ = 0;
            correctCount = 0;
            loadQ();
            showScreen('quizScreen');
        };
        
        // Set up restart button
        restartBtn.onclick = () => {
            currentQ = 0;
            correctCount = 0;
            userAnswers = new Array(quizQuestions.length).fill(null);
            loadQ();
            showScreen('quizScreen');
        };
    };
    
    // Start the quiz with selected topics
    const startQuiz = async () => {
        if (selectedTopics.length === 0) {
            alert('Por favor, selecione pelo menos um tópico para o questionário.');
            return;
        }
        
        showScreen('loadingScreen');
        
        try {
            const questionsLoaded = await loadQuestions();
            
            if (!questionsLoaded || quizQuestions.length === 0) {
                throw new Error('Falha ao carregar as perguntas. Por favor, tente novamente.');
            }
            
            // Reset quiz state
            currentQ = 0;
            correctCount = 0;
            userAnswers = new Array(quizQuestions.length).fill(null);
            
            // Show quiz screen and load first question
            showScreen('quizScreen');
            // Hide timer in normal quiz mode
            if (timeRemainingEl) timeRemainingEl.style.display = 'none';
            loadQ();
            
        } catch (error) {
            console.error('Error starting quiz:', error);
            alert(error.message || 'Ocorreu um erro ao iniciar o questionário.');
            showScreen('startScreen');
        }
    };
    
    // Start the real exam simulation
    const startRealExam = async () => {
        console.log('Starting real exam');
        // Use all topics based on configured distribution
        selectedTopics = Object.keys(topicConfig);
        showScreen('loadingScreen');

        try {
            const loaded = await loadQuestions();
            if (!loaded || quizQuestions.length === 0) throw new Error('Falha ao carregar perguntas');

            // Build exam question set based on distribution percentages
            const examQuestions = [];
            const totalQuestions = 90;
            const percentages = courseConfig.topics;
            let remaining = totalQuestions;

            for (const [topic, info] of Object.entries(percentages)) {
                const pct = info.count; // percentage out of 100
                let count = Math.floor((pct / 100) * totalQuestions);
                if (remaining - count < 0) count = remaining; // safety
                remaining -= count;
                const topicQs = shuffle(quizQuestions.filter(q => q.topic === topic));
                examQuestions.push(...topicQs.slice(0, count));
            }
            // If rounding left some remainder, fill from remaining pool
            if (remaining > 0) {
                const extras = shuffle(quizQuestions.filter(q => !examQuestions.includes(q))).slice(0, remaining);
                examQuestions.push(...extras);
            }
            quizQuestions = shuffle(examQuestions);

            // Reset state
            currentQ = 0;
            correctCount = 0;
            userAnswers = new Array(quizQuestions.length).fill(null);
            examTimeRemaining = courseConfig.examDuration || 5400;

            // Show quiz screen and timer
            showScreen('quizScreen');
            if (timeRemainingEl) timeRemainingEl.style.display = 'flex';
            startExamTimer();
            loadQ();
        } catch (err) {
            console.error('Error starting exam:', err);
            alert(err.message || 'Erro ao iniciar o exame');
            showScreen('startScreen');
        }
    };
    
    // Go back to menu
    const goToMenu = () => {
        showScreen('startScreen');
    };
    
    // Show a specific screen and hide others
    const showScreen = (screenId) => {
        document.querySelectorAll('.screen').forEach(screen => {
            if (screen.id === screenId) {
                screen.classList.add('active');
            } else {
                screen.classList.remove('active');
            }
        });
    };

    // Initialize DOM elements
    const initializeDOMElements = () => {
        console.log('Initializing DOM elements...');
        
        // Screens
        startScreen = document.getElementById('startScreen');
        quizScreen = document.getElementById('quizScreen');
        
        // Start screen elements
        topicList = document.getElementById('topicList');
        
        // Quiz screen elements
        qText = document.getElementById('qText');
        optionsList = document.getElementById('optionsList');
        resultMsg = document.getElementById('resultMsg');
        explText = document.getElementById('explText');
        explanation = document.getElementById('explanation');
        
        // Navigation elements
        prevBtn = document.getElementById('prevBtn');
        nextBtn = document.getElementById('nextBtn');
        submitBtn = document.getElementById('submitBtn');
        menuBtn = document.getElementById('menuBtn');
        
        // Stats elements
        currentQEl = document.getElementById('currentQ');
        totalQEl = document.getElementById('totalQ');
        correctAEl = document.getElementById('correctCount');
        accuracyEl = document.getElementById('accuracy');
        progressFill = document.getElementById('progressFill');
        
        // Timer elements
        timeRemainingEl = document.getElementById('time-remaining');
        timerDisplay = document.getElementById('timer-display');
        
        console.log('DOM elements initialized');
    };
    
    // Check if all required elements exist
    const checkRequiredElements = () => {
        const requiredElements = [
            startScreen, quizScreen, topicList, qText, optionsList,
            resultMsg, explanation, prevBtn, nextBtn, submitBtn,
            currentQEl, totalQEl, correctAEl, accuracyEl, progressFill,
            timeRemainingEl, timerDisplay
        ];
        
        const missingElements = [];
        const elementNames = [
            'startScreen', 'quizScreen', 'topicList', 'qText', 'optionsList',
            'resultMsg', 'explanation', 'prevBtn', 'nextBtn', 'submitBtn',
            'currentQ', 'totalQ', 'correctCount', 'accuracy', 'progressFill',
            'time-remaining', 'timer-display'
        ];
        
        requiredElements.forEach((el, index) => {
            if (!el) {
                missingElements.push(elementNames[index]);
            }
        });
        
        if (missingElements.length > 0) {
            console.error('Missing required elements:', missingElements);
            return false;
        }
        
        return true;
    };
    
    // Initialize the application
    const init = async () => {
        try {
            console.log('Initializing application...');
            
            // Initialize DOM elements
            initializeDOMElements();
            
            // Check if all required elements exist
            if (!checkRequiredElements()) {
                throw new Error('Alguns elementos necessários não foram encontrados no DOM.');
            }
            
            // Load course configuration
            const configLoaded = await loadCourseConfig();
            if (!configLoaded) {
                throw new Error('Falha ao carregar a configuração do curso.');
            }
            
            // Set up event listeners
            setupEventListeners();
            
            // Render the topics
            renderTopics();
            
            // Show start screen
            showScreen('startScreen');
            
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Error initializing application:', error);
            alert(`Erro ao inicializar o aplicativo: ${error.message}`);
        }
    };
    
    // Start the application
    init();
});